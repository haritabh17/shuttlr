/**
 * Shared selection orchestration — the single implementation of
 * "fetch state → run engine → persist assignments → notify players".
 *
 * Imported by both runtimes:
 *   - supabase/functions/session-tick (Deno edge function, cron-driven)
 *   - src/app/api/sessions/[sessionId]/select (Next.js route, manager-driven)
 * Keep this file free of runtime-specific APIs (no Deno.*, no process.*).
 *
 * Locking: callers own the session `selecting` lock. Call acquireSessionLock()
 * before runSelection() and releaseSessionLock() in a finally block, so the
 * lock can span more than one operation (e.g. a whole cron tick).
 */

import {
  selectPlayers,
  extractPairs,
  type Player,
  type PartnerPair,
  type AlgorithmConfig,
  type CourtAssignment,
} from "./selection-engine.ts";

// Minimal structural view of a supabase-js client so this module works with
// both the npm client (Next.js) and the esm.sh client (Deno) without
// importing either package.
export interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc(fn: string, args?: Record<string, unknown>): any;
}

/** The session columns the orchestrator reads (config columns may be absent in stale generated types). */
export interface SessionForSelection {
  id: string;
  club_id: string;
  number_of_courts: number;
  mixed_ratio?: number | null;
  skill_balance?: number | null;
  partner_variety?: number | null;
  strict_gender?: boolean | null;
}

export interface PushGroup {
  userIds: string[];
  title: string;
  body: string;
  tag: string;
  url: string;
}

export interface SelectionContext {
  supabase: SupabaseLike;
  /** Called once per notification group. Implementations must not throw — handle delivery errors internally. */
  sendPush?: (group: PushGroup) => Promise<void>;
}

export type SelectionResult =
  | { ok: true; round: number; courts: number; players: number }
  | { ok: false; reason: "no_players" | "no_courts" | "no_assignments" };

interface CourtRecord {
  id: string;
  name: string;
  locked: boolean | null;
}

interface SessionPlayerRow {
  status: string;
  play_count: number | null;
  user: {
    id: string;
    full_name: string | null;
    gender: string | null;
    level: number | null;
  } | null;
}

/**
 * Compare-and-set the session's `selecting` flag. Returns false if another
 * invocation holds it.
 */
export async function acquireSessionLock(
  supabase: SupabaseLike,
  sessionId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("sessions")
    .update({ selecting: true })
    .eq("id", sessionId)
    .eq("selecting", false)
    .select("id")
    .single();
  return !!data;
}

export async function releaseSessionLock(
  supabase: SupabaseLike,
  sessionId: string,
): Promise<void> {
  await supabase
    .from("sessions")
    .update({ selecting: false })
    .eq("id", sessionId);
}

export async function getMaxRound(
  supabase: SupabaseLike,
  sessionId: string,
): Promise<number> {
  const { data } = await supabase
    .from("court_assignments")
    .select("round")
    .eq("session_id", sessionId)
    .order("round", { ascending: false })
    .limit(1);

  return data?.[0]?.round ?? 0;
}

function normalizeGender(
  raw: string | null | undefined,
): "male" | "female" | null {
  if (raw === "male" || raw === "M") return "male";
  if (raw === "female" || raw === "F") return "female";
  return null;
}

/**
 * Ensure session_players status matches court_assignments.
 * Any player in an active assignment for the current round should be "playing".
 * Any player NOT in an active assignment and currently "playing" should be "available".
 */
export async function syncPlayerStatuses(
  supabase: SupabaseLike,
  sessionId: string,
): Promise<void> {
  const round = await getMaxRound(supabase, sessionId);
  if (round === 0) return;

  const { data: activeAssignments } = await supabase
    .from("court_assignments")
    .select("user_id")
    .eq("session_id", sessionId)
    .eq("assignment_status", "active")
    .eq("round", round);

  if (!activeAssignments) return;

  const onCourtIds: string[] = [
    ...new Set<string>(activeAssignments.map((a: { user_id: string }) => a.user_id)),
  ];

  if (onCourtIds.length > 0) {
    await supabase
      .from("session_players")
      .update({ status: "playing" })
      .eq("session_id", sessionId)
      .in("user_id", onCourtIds)
      .neq("status", "playing");
  }

  let query = supabase
    .from("session_players")
    .update({ status: "available" })
    .eq("session_id", sessionId)
    .eq("status", "playing");
  if (onCourtIds.length > 0) {
    query = query.not("user_id", "in", `(${onCourtIds.join(",")})`);
  }
  await query;
}

/**
 * Run player selection and create court assignments.
 * assignmentStatus: "active" for current round, "upcoming" for next round preview.
 * actorId: the manager who triggered it, or null/undefined for the cron tick.
 *
 * The caller must hold the session lock (acquireSessionLock) and release it
 * afterwards regardless of the outcome.
 */
export async function runSelection(
  ctx: SelectionContext,
  session: SessionForSelection,
  assignmentStatus: "active" | "upcoming",
  actorId?: string | null,
): Promise<SelectionResult> {
  const { supabase } = ctx;

  const { data: sessionPlayers } = await supabase
    .from("session_players")
    .select(
      `id, status, play_count, last_played_at, user_id,
      user:profiles (id, full_name, gender, level)`,
    )
    .eq("session_id", session.id)
    .in("status", ["available", "playing", "resting"]);

  console.log(
    `[select] ${session.id}: ${(sessionPlayers ?? []).length} players, assignmentStatus=${assignmentStatus}`,
  );
  if (!sessionPlayers || sessionPlayers.length === 0) {
    return { ok: false, reason: "no_players" };
  }

  const { data: allCourts } = await supabase
    .from("courts")
    .select("*")
    .eq("club_id", session.club_id)
    .order("name");

  const courts = ((allCourts ?? []) as CourtRecord[])
    .slice(0, session.number_of_courts)
    .filter((c) => !c.locked);

  console.log(
    `[select] ${session.id}: ${courts.length} courts (from ${(allCourts ?? []).length} total)`,
  );
  if (courts.length === 0) {
    return { ok: false, reason: "no_courts" };
  }

  const { data: partnerRows } = await supabase
    .from("partner_history")
    .select("player1_id, player2_id, times_paired")
    .eq("session_id", session.id);

  const partnerHistory: PartnerPair[] = ((partnerRows ?? []) as PartnerPair[]).map(
    (r) => ({
      player1_id: r.player1_id,
      player2_id: r.player2_id,
      times_paired: r.times_paired,
    }),
  );

  // Club-specific level/gender overrides take priority over profile values
  const { data: clubMembers } = await supabase
    .from("club_members")
    .select("user_id, invited_level, invited_gender")
    .eq("club_id", session.club_id)
    .in("status", ["active", "invited"]);

  const memberLevelMap = new Map<string, number | null>();
  const memberGenderMap = new Map<string, string | null>();
  for (const cm of (clubMembers ?? []) as Array<{
    user_id: string | null;
    invited_level: number | null;
    invited_gender: string | null;
  }>) {
    if (cm.user_id) {
      memberLevelMap.set(cm.user_id, cm.invited_level);
      memberGenderMap.set(cm.user_id, cm.invited_gender);
    }
  }

  const playerRows = (sessionPlayers as SessionPlayerRow[]).filter(
    (sp) => sp.user,
  );

  const pool: Player[] = playerRows.map((sp) => {
    const u = sp.user!;
    return {
      id: u.id,
      gender: normalizeGender(memberGenderMap.get(u.id) || u.gender),
      level: memberLevelMap.get(u.id) ?? u.level ?? 3,
      games_played: sp.play_count ?? 0,
      is_on_court: sp.status === "playing",
    };
  });

  const config: AlgorithmConfig = {
    mixed_ratio: session.mixed_ratio ?? 50,
    skill_balance: session.skill_balance ?? 70,
    partner_variety: session.partner_variety ?? 80,
    strict_gender: session.strict_gender ?? true,
  };

  console.log(
    `[select] ${session.id}: pool=${pool.length} players, ${courts.length} courts, strict_gender=${config.strict_gender}`,
  );
  const assignments = selectPlayers(pool, courts.length, config, partnerHistory);

  console.log(
    `[select] ${session.id}: ${assignments.length} court assignments generated`,
  );
  if (assignments.length === 0) {
    return { ok: false, reason: "no_assignments" };
  }

  const newRound = (await getMaxRound(supabase, session.id)) + 1;

  const assignmentRows: Array<{
    session_id: string;
    court_id: string;
    user_id: string;
    round: number;
    assignment_status: string;
    game_type: string;
  }> = [];
  const selectedPlayerIds: string[] = [];

  for (const court of assignments) {
    const courtRecord = courts[court.court_index];
    if (!courtRecord) continue;
    for (const player of [...court.team_a, ...court.team_b]) {
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

  if (assignmentRows.length > 0) {
    await supabase.from("court_assignments").insert(assignmentRows);
  }

  // Record all pairings for this round in one round-trip
  const pairs = extractPairs(assignments);
  if (pairs.length > 0) {
    await supabase.rpc("increment_partner_history_batch", {
      p_session_id: session.id,
      p_pairs: pairs,
    });
  }

  if (assignmentStatus === "active") {
    // Everyone from the previous round — and one-round sit-outs — returns to the pool
    await supabase
      .from("session_players")
      .update({ status: "available" })
      .eq("session_id", session.id)
      .in("status", ["playing", "selected", "sitting_out"]);

    // Mark selected players playing and increment play_count server-side, in one call
    if (selectedPlayerIds.length > 0) {
      await supabase.rpc("begin_round_players", {
        p_session_id: session.id,
        p_user_ids: selectedPlayerIds,
      });
    }

    await supabase
      .from("sessions")
      .update({
        current_round_started_at: new Date().toISOString(),
        current_phase: "playing",
        next_round_selected: false,
      })
      .eq("id", session.id);

    // Sync statuses to catch any manual swaps
    await syncPlayerStatuses(supabase, session.id);
  } else {
    await supabase
      .from("sessions")
      .update({ next_round_selected: true })
      .eq("id", session.id);
  }

  if (ctx.sendPush) {
    await sendRoundPush(
      ctx,
      session,
      assignments,
      courts,
      playerRows,
      newRound,
      assignmentStatus === "upcoming",
    );
  }

  await supabase.from("events").insert({
    club_id: session.club_id,
    session_id: session.id,
    actor_id: actorId ?? null,
    actor_type: actorId ? "human" : "system",
    event_type: "selection_run",
    payload: {
      round: newRound,
      assignment_status: assignmentStatus,
      courts: assignments.length,
      players: selectedPlayerIds.length,
    },
  });

  return {
    ok: true,
    round: newRound,
    courts: assignments.length,
    players: selectedPlayerIds.length,
  };
}

/**
 * Notify each selected player with their court and teammates.
 * Players who share the exact same message are batched into one push group.
 */
async function sendRoundPush(
  ctx: SelectionContext,
  session: SessionForSelection,
  assignments: CourtAssignment[],
  courts: CourtRecord[],
  playerRows: SessionPlayerRow[],
  round: number,
  isUpcoming: boolean,
): Promise<void> {
  const { supabase, sendPush } = ctx;
  if (!sendPush) return;

  // The session page lives at /clubs/[slug]/…, so the deep link needs the slug
  const { data: club } = await supabase
    .from("clubs")
    .select("slug")
    .eq("id", session.club_id)
    .single();

  const sessionUrl = `/clubs/${club?.slug ?? session.club_id}/sessions/${session.id}`;
  const tag = `round-${session.id}-${round}${isUpcoming ? "-upcoming" : ""}`;
  const title = isUpcoming ? "🔜 You're up next!" : "🏸 You're up!";

  const nameMap = new Map<string, string>();
  for (const sp of playerRows) {
    if (sp.user) nameMap.set(sp.user.id, sp.user.full_name ?? "Player");
  }

  const groups = new Map<string, PushGroup>();
  for (const court of assignments) {
    const courtRecord = courts[court.court_index];
    if (!courtRecord) continue;
    const allPlayers = [...court.team_a, ...court.team_b];
    for (const player of allPlayers) {
      const others = allPlayers
        .filter((p) => p.id !== player.id)
        .map((p) => nameMap.get(p.id) ?? "Player")
        .join(", ");
      const body = `Round ${round} · ${courtRecord.name}\nWith: ${others}`;
      const key = `${title}|${body}`;
      const group = groups.get(key) ?? { userIds: [], title, body, tag, url: sessionUrl };
      group.userIds.push(player.id);
      groups.set(key, group);
    }
  }

  for (const group of groups.values()) {
    await sendPush(group);
  }
}
