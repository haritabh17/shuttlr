// Supabase Edge Function: session-tick
// Triggered by pg_cron via pg_net every ~10 seconds.
// Handles phase transitions, player selection, and next-round pre-selection.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";
import {
  selectPlayers,
  extractPairs,
  type Player,
  type PartnerPair,
  type AlgorithmConfig,
  type CourtAssignment,
} from "./selection-engine.ts";

const MAX_SESSION_MS = 6 * 60 * 60 * 1000; // 6 hours

Deno.serve(async (req) => {
  console.log("[tick] Invoked at", new Date().toISOString());
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const url = new URL(req.url);
  const providedSecret =
    url.searchParams.get("secret") || req.headers.get("x-cron-secret");

  if (
    cronSecret &&
    providedSecret !== cronSecret &&
    authHeader !== `Bearer ${serviceRoleKey}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("status", "running")
    .eq("selecting", false);

  if (error || !sessions) {
    return Response.json(
      { error: error?.message ?? "no sessions" },
      { status: 500 },
    );
  }

  console.log(`[tick] Found ${sessions.length} running session(s)`);
  const results: string[] = [];

  for (const session of sessions) {
    try {
      console.log(`[tick] Processing session ${session.id}, phase=${session.current_phase}, round_started=${session.current_round_started_at}`);
      const result = await processSession(supabase, session, serviceRoleKey);
      if (result) { console.log(`[tick] ${session.id}: ${result}`); results.push(`${session.id}: ${result}`); }
    } catch (err) {
      console.error(`[tick] ERROR processing session ${session.id}:`, (err as Error).message, (err as Error).stack);
      results.push(`${session.id}: error - ${(err as Error).message}`);
    }
  }

  return Response.json({ processed: sessions.length, transitions: results });
});

async function processSession(
  supabase: any,
  session: any,
  serviceRoleKey: string,
): Promise<string | null> {
  // Auto-end after 6h
  const started = session.started_at
    ? new Date(session.started_at).getTime()
    : null;
  if (started && Date.now() - started >= MAX_SESSION_MS) {
    await supabase
      .from("sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        current_phase: "idle",
      })
      .eq("id", session.id);

    await logEvent(supabase, session, "session_auto_ended", {
      reason: "6h time limit",
    });
    return "auto-ended (6h limit)";
  }

  const phase = session.current_phase || "idle";
  const roundStarted = session.current_round_started_at
    ? new Date(session.current_round_started_at).getTime()
    : null;

  // Phase: idle → run selection
  if (phase === "idle" || !roundStarted) {
    await runSelection(supabase, session, serviceRoleKey, "active");
    return "idle → selection → playing";
  }

  const elapsed = Date.now() - roundStarted;

  if (phase === "playing") {
    const playMs = session.play_time_minutes * 60 * 1000;
    const selectionMs = (session.selection_interval_minutes ?? session.play_time_minutes) * 60 * 1000;

    // Mid-round: fire next-round selection at selection_interval
    if (
      !session.next_round_selected &&
      selectionMs < playMs &&
      elapsed >= selectionMs
    ) {
      await runSelection(supabase, session, serviceRoleKey, "upcoming");
      return "mid-round → next round selected";
    }

    // End of play time
    if (elapsed >= playMs) {
      if (session.rest_time_minutes > 0) {
        await supabase
          .from("sessions")
          .update({
            current_phase: "resting",
            current_round_started_at: new Date().toISOString(),
            next_round_selected: false,
          })
          .eq("id", session.id);

        return "playing → resting";
      } else {
        // Promote upcoming → active, or run fresh selection
        await promoteOrSelect(supabase, session, serviceRoleKey);
        return "playing → selection → playing";
      }
    }
  } else if (phase === "resting") {
    const restMs = session.rest_time_minutes * 60 * 1000;
    if (elapsed >= restMs) {
      await promoteOrSelect(supabase, session, serviceRoleKey);
      return "resting → selection → playing";
    }
  }

  return null;
}

/**
 * If upcoming assignments exist, promote them to active.
 * Otherwise run a fresh selection.
 */
async function promoteOrSelect(
  supabase: any,
  session: any,
  serviceRoleKey: string,
) {
  const { data: upcoming } = await supabase
    .from("court_assignments")
    .select("id")
    .eq("session_id", session.id)
    .eq("assignment_status", "upcoming")
    .limit(1);

  if (upcoming && upcoming.length > 0) {
    // Clear current active assignments' players
    await supabase
      .from("session_players")
      .update({ status: "available" })
      .eq("session_id", session.id)
      .in("status", ["playing", "selected"]);

    // Promote upcoming → active
    await supabase
      .from("court_assignments")
      .update({ assignment_status: "active" })
      .eq("session_id", session.id)
      .eq("assignment_status", "upcoming");

    // Get the upcoming players and mark them as playing
    const { data: newAssignments } = await supabase
      .from("court_assignments")
      .select("user_id")
      .eq("session_id", session.id)
      .eq("assignment_status", "active")
      .eq("round", (await getMaxRound(supabase, session.id)));

    if (newAssignments) {
      for (const a of newAssignments) {
        await supabase
          .from("session_players")
          .update({
            status: "playing",
            play_count: supabase.rpc ? undefined : undefined, // handled below
            last_played_at: new Date().toISOString(),
          })
          .eq("session_id", session.id)
          .eq("user_id", a.user_id);

        // Increment play count
        try {
          await supabase.rpc("increment_play_count", {
            p_session_id: session.id,
            p_user_id: a.user_id,
          });
        } catch {
          // Fallback: raw update
          await supabase
            .from("session_players")
            .update({ last_played_at: new Date().toISOString() })
            .eq("session_id", session.id)
            .eq("user_id", a.user_id);
        }
      }
    }

    // Update session
    await supabase
      .from("sessions")
      .update({
        current_round_started_at: new Date().toISOString(),
        current_phase: "playing",
        selecting: false,
        next_round_selected: false,
      })
      .eq("id", session.id);

    // Sync statuses to catch any manual swaps
    await syncPlayerStatuses(supabase, session.id);

    // No push here — players already got "You're up next!" when upcoming was selected
  } else {
    // No upcoming — run fresh selection
    await runSelection(supabase, session, serviceRoleKey, "active");
  }
}

/**
 * Run player selection and create court assignments.
 * assignmentStatus: "active" for current round, "upcoming" for next round preview
 */
async function runSelection(
  supabase: any,
  session: any,
  serviceRoleKey: string,
  assignmentStatus: "active" | "upcoming",
) {
  // Acquire lock
  const { data: lockRow } = await supabase
    .from("sessions")
    .update({ selecting: true })
    .eq("id", session.id)
    .eq("selecting", false)
    .select("id")
    .single();

  if (!lockRow) { console.log(`[select] Could not acquire lock for ${session.id}`); return; }

  try {
    // Get session players
    const { data: sessionPlayers } = await supabase
      .from("session_players")
      .select(
        `id, status, play_count, last_played_at, user_id,
        user:profiles (id, full_name, gender, level)`,
      )
      .eq("session_id", session.id)
      .in("status", ["available", "playing", "resting"]);

    console.log(`[select] ${session.id}: ${(sessionPlayers ?? []).length} players, assignmentStatus=${assignmentStatus}`);
    if (!sessionPlayers || sessionPlayers.length === 0) {
      await supabase
        .from("sessions")
        .update({ selecting: false })
        .eq("id", session.id);
      return;
    }

    // Get courts
    const { data: allCourts } = await supabase
      .from("courts")
      .select("*")
      .eq("club_id", session.club_id)
      .order("name");

    const courts = (allCourts ?? [])
      .slice(0, session.number_of_courts)
      .filter((c: any) => !c.locked);

    console.log(`[select] ${session.id}: ${courts.length} courts (from ${(allCourts ?? []).length} total)`);
    if (courts.length === 0) {
      await supabase
        .from("sessions")
        .update({ selecting: false })
        .eq("id", session.id);
      return;
    }

    // Get partner history
    const { data: partnerRows } = await supabase
      .from("partner_history")
      .select("player1_id, player2_id, times_paired")
      .eq("session_id", session.id);

    const partnerHistory: PartnerPair[] = (partnerRows ?? []).map((r: any) => ({
      player1_id: r.player1_id,
      player2_id: r.player2_id,
      times_paired: r.times_paired,
    }));

    // Fetch club-specific levels from club_members
    const { data: clubMembers } = await supabase
      .from("club_members")
      .select("user_id, invited_level, invited_gender")
      .eq("club_id", session.club_id)
      .in("status", ["active", "invited"]);

    const memberLevelMap = new Map<string, number | null>();
    const memberGenderMap = new Map<string, string | null>();
    for (const cm of clubMembers ?? []) {
      memberLevelMap.set(cm.user_id, cm.invited_level);
      memberGenderMap.set(cm.user_id, cm.invited_gender);
    }

    // Build player pool (club-specific level takes priority over profile level)
    const pool: Player[] = sessionPlayers
      .filter((sp: any) => sp.user)
      .map((sp: any) => {
        const clubLevel = memberLevelMap.get(sp.user.id);
        const clubGender = memberGenderMap.get(sp.user.id);
        const rawGender = clubGender || sp.user.gender;
        return {
        id: sp.user.id,
        gender:
          (rawGender === "male" || rawGender === "M")
            ? "male"
            : (rawGender === "female" || rawGender === "F")
              ? "female"
              : null,
        level: clubLevel ?? sp.user.level ?? 3,
        games_played: sp.play_count ?? 0,
        is_on_court: sp.status === "playing",
      };
      });

    // Algorithm config
    const config: AlgorithmConfig = {
      mixed_ratio: session.mixed_ratio ?? 50,
      skill_balance: session.skill_balance ?? 70,
      partner_variety: session.partner_variety ?? 80,
      strict_gender: session.strict_gender ?? true,
    };


    // Get cumulative game type history for this session
    const { data: pastAssignments } = await supabase
      .from("court_assignments")
      .select("game_type")
      .eq("session_id", session.id)
      .neq("assignment_status", "upcoming");

    const gameTypeHistory = {
      mixed: (pastAssignments ?? []).filter((a: any) => a.game_type === "mixed").length,
      doubles: (pastAssignments ?? []).filter((a: any) => a.game_type === "doubles").length,
    };
    console.log(`[select] Game type history: ${gameTypeHistory.mixed} mixed, ${gameTypeHistory.doubles} doubles`);

    console.log(`[select] ${session.id}: pool=${pool.length} players, ${courts.length} courts, strict_gender=${config.strict_gender}`);
    console.log(`[select] Gender breakdown:`, pool.reduce((acc, p) => { acc[p.gender || "null"] = (acc[p.gender || "null"] || 0) + 1; return acc; }, {} as Record<string, number>));
    const assignments = selectPlayers(pool, courts.length, config, partnerHistory, gameTypeHistory);

    console.log(`[select] ${session.id}: ${assignments.length} court assignments generated`);
    if (assignments.length === 0) {
      console.log(`[select] ${session.id}: NO assignments — selection engine returned empty`);
      await supabase
        .from("sessions")
        .update({ selecting: false })
        .eq("id", session.id);
      return;
    }

    // Get round number
    const currentMax = await getMaxRound(supabase, session.id);
    const newRound =
      assignmentStatus === "upcoming" ? currentMax + 1 : currentMax + 1;

    // Write court assignments
    const assignmentRows: any[] = [];
    const selectedPlayerIds: string[] = [];
    const playerNames: string[] = [];

    for (const court of assignments) {
      const courtRecord = courts[court.court_index];
      if (!courtRecord) continue;

      const allPlayers = [...court.team_a, ...court.team_b];
      for (const player of allPlayers) {
        assignmentRows.push({
          session_id: session.id,
          court_id: courtRecord.id,
          user_id: player.id,
          round: newRound,
          assignment_status: assignmentStatus,
          game_type: court.game_type,
        });
        if (!selectedPlayerIds.includes(player.id)) {
          selectedPlayerIds.push(player.id);
        }
      }
    }

    // Build push context: court name + teammates for each player
    const nameMap = new Map<string, string>();
    for (const sp of sessionPlayers) {
      if (sp.user) nameMap.set(sp.user.id, sp.user.full_name ?? "Player");
    }

    const playerContexts = new Map<string, PushContext>();
    for (const court of assignments) {
      const courtRecord = courts[court.court_index];
      if (!courtRecord) continue;
      const allPlayers = [...court.team_a, ...court.team_b];
      for (const player of allPlayers) {
        const teammates = allPlayers
          .filter((p) => p.id !== player.id)
          .map((p) => nameMap.get(p.id) ?? "Player");
        playerContexts.set(player.id, {
          courtName: courtRecord.name,
          teammates,
        });
      }
    }

    if (assignmentRows.length > 0) {
      await supabase.from("court_assignments").insert(assignmentRows);
    }

    // Update partner history
    const pairs = extractPairs(assignments);
    for (const pair of pairs) {
      await supabase.from("partner_history").upsert(
        {
          session_id: session.id,
          player1_id: pair.player1_id,
          player2_id: pair.player2_id,
          times_paired: 1,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "session_id,player1_id,player2_id",
          ignoreDuplicates: false,
        },
      );
      // Increment if exists — upsert doesn't do increment, so do a manual update
      try {
        await supabase.rpc("increment_partner_history", {
          p_session_id: session.id,
          p_player1_id: pair.player1_id,
          p_player2_id: pair.player2_id,
        });
      } catch {
        // RPC might not exist yet, partner_history upsert handles creation
      }
    }

    if (assignmentStatus === "active") {
      // Return current players to available
      await supabase
        .from("session_players")
        .update({ status: "available" })
        .eq("session_id", session.id)
        .in("status", ["playing", "selected"]);

      // Mark selected players as playing
      for (const playerId of selectedPlayerIds) {
        await supabase
          .from("session_players")
          .update({
            status: "playing",
            play_count:
              (pool.find((p) => p.id === playerId)?.games_played ?? 0) + 1,
            last_played_at: new Date().toISOString(),
          })
          .eq("session_id", session.id)
          .eq("user_id", playerId);
      }

      // Update session state
      await supabase
        .from("sessions")
        .update({
          current_round_started_at: new Date().toISOString(),
          current_phase: "playing",
          selecting: false,
          next_round_selected: false,
        })
        .eq("id", session.id);

      // Sync statuses to catch any manual swaps
      await syncPlayerStatuses(supabase, session.id);

      // Push notifications
      await sendPushNotifications(
        supabase,
        session,
        selectedPlayerIds,
        newRound,
        serviceRoleKey,
        false,
        playerContexts,
      );
    } else {
      // Upcoming: just mark session and release lock
      await supabase
        .from("sessions")
        .update({
          selecting: false,
          next_round_selected: true,
        })
        .eq("id", session.id);

      // Push "heads up" to upcoming players
      await sendPushNotifications(
        supabase,
        session,
        selectedPlayerIds,
        newRound,
        serviceRoleKey,
        true,
        playerContexts,
      );
    }

    // Log event
    await logEvent(supabase, session, "selection_run", {
      round: newRound,
      assignment_status: assignmentStatus,
      courts: assignments.map((a) => ({
        court_index: a.court_index,
        game_type: a.game_type,
        team_a: a.team_a.map((p) => p.id),
        team_b: a.team_b.map((p) => p.id),
      })),
    });
  } catch (err) {
    await supabase
      .from("sessions")
      .update({ selecting: false })
      .eq("id", session.id);
    throw err;
  }
}

async function getMaxRound(supabase: any, sessionId: string): Promise<number> {
  const { data } = await supabase
    .from("court_assignments")
    .select("round")
    .eq("session_id", sessionId)
    .order("round", { ascending: false })
    .limit(1);

  return data?.[0]?.round ?? 0;
}

/**
 * Ensure session_players status matches court_assignments.
 * Any player in an active assignment for the current round should be "playing".
 * Any player NOT in an active assignment and currently "playing" should be "available".
 */
async function syncPlayerStatuses(supabase: any, sessionId: string) {
  const round = await getMaxRound(supabase, sessionId);
  if (round === 0) return;

  const { data: activeAssignments } = await supabase
    .from("court_assignments")
    .select("user_id")
    .eq("session_id", sessionId)
    .eq("assignment_status", "active")
    .eq("round", round);

  if (!activeAssignments) return;

  const onCourtIds = new Set(activeAssignments.map((a: any) => a.user_id));

  // Mark on-court players as "playing" if they aren't already
  for (const a of activeAssignments) {
    await supabase
      .from("session_players")
      .update({ status: "playing" })
      .eq("session_id", sessionId)
      .eq("user_id", a.user_id)
      .neq("status", "playing");
  }

  // Mark any "playing" player NOT on court as "available"
  const { data: playingPlayers } = await supabase
    .from("session_players")
    .select("user_id")
    .eq("session_id", sessionId)
    .eq("status", "playing");

  if (playingPlayers) {
    for (const p of playingPlayers) {
      if (!onCourtIds.has(p.user_id)) {
        await supabase
          .from("session_players")
          .update({ status: "available" })
          .eq("session_id", sessionId)
          .eq("user_id", p.user_id);
      }
    }
  }
}

interface PushContext {
  courtName: string;
  teammates: string[]; // names of the other 3 players
}

async function sendPushNotifications(
  supabase: any,
  session: any,
  playerIds: string[],
  round: number,
  serviceRoleKey: string,
  isUpcoming = false,
  playerContexts?: Map<string, PushContext>,
) {
  if (playerIds.length === 0) return;

  const appUrl = Deno.env.get("APP_URL") || "https://beta.shuttlrs.com";
  const sessionUrl = `/clubs/${session.club_id}/sessions/${session.id}`;
  const tag = `round-${session.id}-${round}${isUpcoming ? "-upcoming" : ""}`;

  // Send per-player notifications with court + teammate details
  for (const playerId of playerIds) {
    const ctx = playerContexts?.get(playerId);
    let body: string;

    if (ctx) {
      const others = ctx.teammates.join(", ");
      body = isUpcoming
        ? `Round ${round} · ${ctx.courtName}\nWith: ${others}`
        : `Round ${round} · ${ctx.courtName}\nWith: ${others}`;
    } else {
      body = isUpcoming
        ? `Round ${round} — Get ready!`
        : `Round ${round} — Head to your court!`;
    }

    try {
      await fetch(`${appUrl}/api/push/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          userIds: [playerId],
          title: isUpcoming ? "🔜 You're up next!" : "🏸 You're up!",
          body,
          tag,
          url: sessionUrl,
        }),
      });
    } catch (err) {
      console.error(`Push failed for ${playerId}:`, err);
    }
  }
}

async function logEvent(
  supabase: any,
  session: any,
  eventType: string,
  payload: any,
) {
  await supabase.from("events").insert({
    club_id: session.club_id,
    session_id: session.id,
    actor_id: null,
    actor_type: "system",
    event_type: eventType,
    payload,
  });
}
