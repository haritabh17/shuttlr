import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectPlayers, type Player } from "@/lib/selection";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get session
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Verify user is a manager
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", session.club_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Only managers can run selection" }, { status: 403 });
  }

  // Use admin client for all writes (bypasses RLS)
  const admin = createAdminClient();

  // Optimistic lock: atomically set selecting_round flag to prevent concurrent runs
  const { data: lockRow, error: lockErr } = await admin
    .from("sessions")
    .update({ selecting: true } as any)
    .eq("id", sessionId)
    .eq("selecting", false)
    .select("id")
    .single();

  if (!lockRow) {
    return NextResponse.json({ error: "Selection already in progress" }, { status: 409 });
  }

  // Ensure we release the lock on exit
  const releaseLock = () =>
    admin.from("sessions").update({ selecting: false } as any).eq("id", sessionId);

  try {

  // Get available session players with profile data
  const { data: sessionPlayers } = await supabase
    .from("session_players")
    .select(`
      id,
      status,
      play_count,
      last_played_at,
      user_id,
      user:profiles (
        id,
        full_name,
        gender,
        level
      )
    `)
    .eq("session_id", sessionId)
    .in("status", ["available", "playing", "resting"]);

  if (!sessionPlayers || sessionPlayers.length === 0) {
    return NextResponse.json({ error: "No available players" }, { status: 400 });
  }

  // Get courts for this session (limited to number_of_courts), then filter unlocked
  const { data: allCourts } = await supabase
    .from("courts")
    .select("*")
    .eq("club_id", session.club_id)
    .order("name");

  const sessionCourts = (allCourts ?? []).slice(0, session.number_of_courts);
  const courts = sessionCourts.filter((c) => !c.locked);
  const nCourts = courts.length;

  if (nCourts === 0) {
    return NextResponse.json({ error: "No unlocked courts available" }, { status: 400 });
  }

  // Build teammate history from past assignments
  const { data: pastAssignments } = await supabase
    .from("court_assignments")
    .select("court_id, round, user_id")
    .eq("session_id", sessionId);

  const teammateHistory: Record<string, Record<string, number>> = {};
  if (pastAssignments) {
    // Group by court+round
    const groups: Record<string, string[]> = {};
    for (const a of pastAssignments) {
      const key = `${a.court_id}-${a.round}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(a.user_id);
    }
    // Count co-occurrences
    for (const group of Object.values(groups)) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (!teammateHistory[group[i]]) teammateHistory[group[i]] = {};
          if (!teammateHistory[group[j]]) teammateHistory[group[j]] = {};
          teammateHistory[group[i]][group[j]] =
            (teammateHistory[group[i]][group[j]] || 0) + 1;
          teammateHistory[group[j]][group[i]] =
            (teammateHistory[group[j]][group[i]] || 0) + 1;
        }
      }
    }
  }

  // Map to Player interface
  const pool: Player[] = sessionPlayers
    .filter((sp) => sp.user)
    .map((sp) => ({
      id: sp.user!.id,
      full_name: sp.user!.full_name,
      gender: (sp.user!.gender || "M") as "M" | "F",
      level: sp.user!.level ?? 5,
      play_count: sp.play_count,
      last_played_at: sp.last_played_at,
      teammate_history: teammateHistory[sp.user!.id] || {},
    }));

  // Return current players to pool
  await admin
    .from("session_players")
    .update({ status: "available" })
    .eq("session_id", sessionId)
    .in("status", ["playing", "selected"]);

  // Run selection
  const assignments = selectPlayers(pool, nCourts);

  // Get current max round
  const { data: maxRoundData } = await supabase
    .from("court_assignments")
    .select("round")
    .eq("session_id", sessionId)
    .order("round", { ascending: false })
    .limit(1);

  const newRound = (maxRoundData?.[0]?.round ?? 0) + 1;

  // Write assignments
  const assignmentRows = [];
  const selectedPlayerIds: string[] = [];

  for (const court of assignments) {
    const courtRecord = courts![court.courtIndex];
    for (const player of court.players) {
      assignmentRows.push({
        session_id: sessionId,
        court_id: courtRecord.id,
        user_id: player.id,
        round: newRound,
      });
      selectedPlayerIds.push(player.id);
    }
  }

  if (assignmentRows.length > 0) {
    await admin.from("court_assignments").insert(assignmentRows);

    // Update session_players status and play count
    for (const playerId of selectedPlayerIds) {
      await admin
        .from("session_players")
        .update({
          status: "playing",
          play_count: pool.find((p) => p.id === playerId)!.play_count + 1,
          last_played_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("user_id", playerId);
    }
  }

  // Update session phase: now playing with a fresh round timer
  await admin
    .from("sessions")
    .update({
      current_round_started_at: new Date().toISOString(),
      current_phase: "playing",
    } as any)
    .eq("id", sessionId);

  // Log event
  await admin.from("events").insert({
    club_id: session.club_id,
    session_id: sessionId,
    actor_id: user.id,
    actor_type: "system",
    event_type: "selection_run",
    payload: {
      round: newRound,
      courts: assignments.map((a) => ({
        courtIndex: a.courtIndex,
        players: a.players.map((p) => p.full_name),
      })),
    },
  });

  await releaseLock();
  return NextResponse.json({
    round: newRound,
    assignments: assignments.map((a) => ({
      court: courts![a.courtIndex].name,
      players: a.players.map((p) => ({
        name: p.full_name,
        gender: p.gender,
        level: p.level,
      })),
    })),
  });

  } catch (err) {
    await releaseLock();
    throw err;
  }
}
