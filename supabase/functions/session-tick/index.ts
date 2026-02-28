// Supabase Edge Function: session-tick
// Triggered by pg_cron via pg_net every ~10 seconds.
// Polls active sessions and handles phase transitions + selection.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

// === Selection Algorithm (inlined for Deno compatibility) ===

interface Player {
  id: string;
  full_name: string;
  gender: "M" | "F";
  level: number;
  play_count: number;
  last_played_at: string | null;
  teammate_history: Record<string, number>;
}

interface CourtAssignment {
  courtIndex: number;
  players: Player[];
}

const WEIGHTS = { teammate_repeat: 5, level_distance: 3, play_count: 1 };

function selectPlayers(pool: Player[], nCourts: number): CourtAssignment[] {
  const playersNeeded = nCourts * 4;
  if (pool.length < playersNeeded) {
    const actual = Math.floor(pool.length / 4);
    if (actual === 0) return [];
    return selectPlayers(pool, actual);
  }

  const sorted = [...pool].sort((a, b) => {
    if (a.play_count !== b.play_count) return a.play_count - b.play_count;
    const aT = a.last_played_at ? new Date(a.last_played_at).getTime() : 0;
    const bT = b.last_played_at ? new Date(b.last_played_at).getTime() : 0;
    return aT - bT;
  });

  const candidates = sorted.slice(0, playersNeeded);
  const males = candidates.filter((p) => p.gender === "M");
  const females = candidates.filter((p) => p.gender === "F");

  const courts: CourtAssignment[] = [];
  const availM = [...males], availF = [...females];

  for (let i = 0; i < nCourts; i++) {
    const court: Player[] = [];
    if (availM.length >= 2 && availF.length >= 2) {
      court.push(availM.shift()!, availM.shift()!, availF.shift()!, availF.shift()!);
    } else if (availM.length >= 4) {
      court.push(availM.shift()!, availM.shift()!, availM.shift()!, availM.shift()!);
    } else if (availF.length >= 4) {
      court.push(availF.shift()!, availF.shift()!, availF.shift()!, availF.shift()!);
    } else {
      const rem = [...availM, ...availF];
      while (court.length < 4 && rem.length > 0) court.push(rem.shift()!);
      availM.length = 0; availF.length = 0;
    }
    courts.push({ courtIndex: i, players: court });
  }

  // Optimize swaps
  let bestScore = totalScore(courts);
  let improved = true, iter = 0;
  while (improved && iter < 100) {
    improved = false; iter++;
    for (let i = 0; i < courts.length; i++) {
      for (let j = i + 1; j < courts.length; j++) {
        for (let pi = 0; pi < courts[i].players.length; pi++) {
          for (let pj = 0; pj < courts[j].players.length; pj++) {
            if (courts[i].players[pi].gender !== courts[j].players[pj].gender) continue;
            const a = courts[i].players[pi], b = courts[j].players[pj];
            courts[i].players[pi] = b; courts[j].players[pj] = a;
            const s = totalScore(courts);
            if (s < bestScore) { bestScore = s; improved = true; }
            else { courts[i].players[pi] = a; courts[j].players[pj] = b; }
          }
        }
      }
    }
  }
  return courts;
}

function totalScore(courts: CourtAssignment[]): number {
  let score = 0;
  for (const court of courts) {
    const p = court.players;
    if (p.length > 0) {
      const levels = p.map((x) => x.level);
      const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
      score += levels.reduce((s, l) => s + (l - mean) ** 2, 0) / levels.length * WEIGHTS.level_distance;
      const counts = p.map((x) => x.play_count);
      score += (Math.max(...counts) - Math.min(...counts)) * WEIGHTS.play_count;
    }
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const h = p[i].teammate_history;
        if (h && h[p[j].id]) score += h[p[j].id] * WEIGHTS.teammate_repeat;
      }
    }
  }
  return score;
}

// === Main Handler ===

Deno.serve(async (req) => {
  // Verify request is authorized (use service role key or a shared secret)
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Allow calls from pg_net (no auth header) or with valid service key
  // In production, use a shared secret for pg_net calls
  const cronSecret = Deno.env.get("CRON_SECRET");
  const url = new URL(req.url);
  const providedSecret = url.searchParams.get("secret") || req.headers.get("x-cron-secret");

  if (cronSecret && providedSecret !== cronSecret && authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fetch all running sessions that aren't currently being selected
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("status", "running")
    .eq("selecting", false);

  if (error || !sessions) {
    return new Response(JSON.stringify({ error: error?.message ?? "no sessions" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: string[] = [];

  for (const session of sessions) {
    const phase = session.current_phase || "idle";
    const roundStarted = session.current_round_started_at
      ? new Date(session.current_round_started_at).getTime()
      : null;

    if (phase === "idle" || !roundStarted) {
      await runSelection(supabase, session);
      results.push(`${session.id}: idle → selection → playing`);
      continue;
    }

    const elapsed = Date.now() - roundStarted;

    if (phase === "playing") {
      const playMs = session.play_time_minutes * 60 * 1000;
      if (elapsed >= playMs) {
        if (session.rest_time_minutes > 0) {
          // Transition to rest
          await supabase
            .from("sessions")
            .update({
              current_phase: "resting",
              current_round_started_at: new Date().toISOString(),
            })
            .eq("id", session.id);

          await supabase
            .from("session_players")
            .update({ status: "available" })
            .eq("session_id", session.id)
            .in("status", ["playing", "selected"]);

          results.push(`${session.id}: playing → resting`);
        } else {
          await runSelection(supabase, session);
          results.push(`${session.id}: playing → selection → playing`);
        }
      }
    } else if (phase === "resting") {
      const restMs = session.rest_time_minutes * 60 * 1000;
      if (elapsed >= restMs) {
        await runSelection(supabase, session);
        results.push(`${session.id}: resting → selection → playing`);
      }
    }
  }

  return new Response(JSON.stringify({ processed: sessions.length, transitions: results }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function runSelection(supabase: any, session: any) {
  // Acquire optimistic lock
  const { data: lockRow } = await supabase
    .from("sessions")
    .update({ selecting: true })
    .eq("id", session.id)
    .eq("selecting", false)
    .select("id")
    .single();

  if (!lockRow) return;

  try {
    // Get session players
    const { data: sessionPlayers } = await supabase
      .from("session_players")
      .select(`
        id, status, play_count, last_played_at, user_id,
        user:profiles (id, full_name, gender, level)
      `)
      .eq("session_id", session.id)
      .in("status", ["available", "playing", "resting"]);

    if (!sessionPlayers || sessionPlayers.length === 0) {
      await supabase.from("sessions").update({ selecting: false }).eq("id", session.id);
      return;
    }

    // Get unlocked courts
    const { data: allCourts } = await supabase
      .from("courts")
      .select("*")
      .eq("club_id", session.club_id)
      .order("name");

    const courts = (allCourts ?? []).slice(0, session.number_of_courts).filter((c: any) => !c.locked);
    if (courts.length === 0) {
      await supabase.from("sessions").update({ selecting: false }).eq("id", session.id);
      return;
    }

    // Build teammate history
    const { data: pastAssignments } = await supabase
      .from("court_assignments")
      .select("court_id, round, user_id")
      .eq("session_id", session.id);

    const teammateHistory: Record<string, Record<string, number>> = {};
    if (pastAssignments) {
      const groups: Record<string, string[]> = {};
      for (const a of pastAssignments) {
        const key = `${a.court_id}-${a.round}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(a.user_id);
      }
      for (const group of Object.values(groups)) {
        for (let i = 0; i < (group as string[]).length; i++) {
          for (let j = i + 1; j < (group as string[]).length; j++) {
            const gi = (group as string[])[i], gj = (group as string[])[j];
            if (!teammateHistory[gi]) teammateHistory[gi] = {};
            if (!teammateHistory[gj]) teammateHistory[gj] = {};
            teammateHistory[gi][gj] = (teammateHistory[gi][gj] || 0) + 1;
            teammateHistory[gj][gi] = (teammateHistory[gj][gi] || 0) + 1;
          }
        }
      }
    }

    const pool: Player[] = sessionPlayers
      .filter((sp: any) => sp.user)
      .map((sp: any) => ({
        id: sp.user.id,
        full_name: sp.user.full_name,
        gender: (sp.user.gender || "M") as "M" | "F",
        level: sp.user.level ?? 5,
        play_count: sp.play_count,
        last_played_at: sp.last_played_at,
        teammate_history: teammateHistory[sp.user.id] || {},
      }));

    // Return current players to pool
    await supabase
      .from("session_players")
      .update({ status: "available" })
      .eq("session_id", session.id)
      .in("status", ["playing", "selected"]);

    // Run selection
    const assignments = selectPlayers(pool, courts.length);

    // Get new round number
    const { data: maxRoundData } = await supabase
      .from("court_assignments")
      .select("round")
      .eq("session_id", session.id)
      .order("round", { ascending: false })
      .limit(1);

    const newRound = (maxRoundData?.[0]?.round ?? 0) + 1;

    // Write assignments
    const assignmentRows: any[] = [];
    const selectedPlayerIds: string[] = [];

    for (const court of assignments) {
      const courtRecord = courts[court.courtIndex];
      for (const player of court.players) {
        assignmentRows.push({
          session_id: session.id,
          court_id: courtRecord.id,
          user_id: player.id,
          round: newRound,
        });
        selectedPlayerIds.push(player.id);
      }
    }

    if (assignmentRows.length > 0) {
      await supabase.from("court_assignments").insert(assignmentRows);

      for (const playerId of selectedPlayerIds) {
        const p = pool.find((x) => x.id === playerId)!;
        await supabase
          .from("session_players")
          .update({
            status: "playing",
            play_count: p.play_count + 1,
            last_played_at: new Date().toISOString(),
          })
          .eq("session_id", session.id)
          .eq("user_id", playerId);
      }
    }

    // Update session phase + release lock
    await supabase
      .from("sessions")
      .update({
        current_round_started_at: new Date().toISOString(),
        current_phase: "playing",
        selecting: false,
      })
      .eq("id", session.id);

    // Send push notifications to selected players
    if (selectedPlayerIds.length > 0) {
      const courtNames = assignments.map((a: CourtAssignment) => {
        const courtRecord = courts[a.courtIndex];
        return `${courtRecord.name}: ${a.players.map((p) => p.full_name).join(", ")}`;
      });

      try {
        const appUrl = Deno.env.get("APP_URL") || "https://beta.shuttlrs.com";
        await fetch(`${appUrl}/api/push/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            userIds: selectedPlayerIds,
            title: "🏸 You're up!",
            body: `Round ${newRound} — Head to your court!`,
            tag: `round-${session.id}-${newRound}`,
            url: `/clubs/${session.club_id}/sessions/${session.id}`,
          }),
        });
      } catch (pushErr) {
        console.error("Push notification failed:", pushErr);
      }
    }

    // Log event
    await supabase.from("events").insert({
      club_id: session.club_id,
      session_id: session.id,
      actor_id: null,
      actor_type: "system",
      event_type: "selection_run",
      payload: {
        round: newRound,
        source: "edge-function",
        courts: assignments.map((a: CourtAssignment) => ({
          courtIndex: a.courtIndex,
          players: a.players.map((p) => p.full_name),
        })),
      },
    });
  } catch (err) {
    await supabase.from("sessions").update({ selecting: false }).eq("id", session.id);
    console.error(`Selection error for session ${session.id}:`, err);
  }
}
