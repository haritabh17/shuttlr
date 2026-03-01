import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { player1Id, player2Id } = await request.json();
  if (!player1Id || !player2Id || player1Id === player2Id) {
    return NextResponse.json({ error: "Two different player IDs required" }, { status: 400 });
  }

  // Get session
  const { data: session } = await supabase
    .from("sessions")
    .select("club_id, status")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Manager check
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", session.club_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Only managers can swap players" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Find current/upcoming assignments for both players
  const { data: allAssignments } = await (admin as any)
    .from("court_assignments")
    .select("id, user_id, court_id, round, assignment_status")
    .eq("session_id", sessionId)
    .in("assignment_status", ["active", "upcoming"])
    .in("user_id", [player1Id, player2Id]);

  // Get the latest round for active and upcoming separately
  const activeAssignments = (allAssignments ?? []).filter((a: any) => a.assignment_status === "active");
  const upcomingAssignments = (allAssignments ?? []).filter((a: any) => a.assignment_status === "upcoming");

  // Find assignments for each player (prefer upcoming, then active)
  const findAssignment = (playerId: string) => {
    const upcoming = upcomingAssignments.filter((a: any) => a.user_id === playerId);
    if (upcoming.length > 0) {
      const maxRound = Math.max(...upcoming.map((a: any) => a.round));
      return upcoming.find((a: any) => a.round === maxRound);
    }
    const active = activeAssignments.filter((a: any) => a.user_id === playerId);
    if (active.length > 0) {
      const maxRound = Math.max(...active.map((a: any) => a.round));
      return active.find((a: any) => a.round === maxRound);
    }
    return null;
  };

  const a1 = findAssignment(player1Id);
  const a2 = findAssignment(player2Id);

  if (!a1 && !a2) {
    return NextResponse.json({ error: "Neither player is on a court" }, { status: 400 });
  }

  if (a1 && a2) {
    // Both on courts — swap their court_id (and round must match for it to make sense)
    if (a1.assignment_status !== a2.assignment_status) {
      return NextResponse.json({ error: "Cannot swap between active and upcoming rounds" }, { status: 400 });
    }
    // Swap user_ids on the two assignment rows
    await admin.from("court_assignments").update({ user_id: player2Id }).eq("id", a1.id);
    await admin.from("court_assignments").update({ user_id: player1Id }).eq("id", a2.id);

    return NextResponse.json({ ok: true, type: "court_to_court" });
  }

  // One on court, one in pool
  const courtAssignment = a1 || a2;
  const courtPlayerId = courtAssignment.user_id;
  const poolPlayerId = courtPlayerId === player1Id ? player2Id : player1Id;
  const isActive = courtAssignment.assignment_status === "active";

  // Replace on court
  await admin.from("court_assignments").update({ user_id: poolPlayerId }).eq("id", courtAssignment.id);

  // Update session_players statuses
  if (isActive) {
    // Active game: outgoing → available, incoming → playing (and increment play count)
    await admin
      .from("session_players")
      .update({ status: "available" })
      .eq("session_id", sessionId)
      .eq("user_id", courtPlayerId);

    // Get incoming player's current play_count
    const { data: poolPlayer } = await admin
      .from("session_players")
      .select("play_count")
      .eq("session_id", sessionId)
      .eq("user_id", poolPlayerId)
      .single();

    await admin
      .from("session_players")
      .update({
        status: "playing",
        play_count: (poolPlayer?.play_count ?? 0) + 1,
        last_played_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .eq("user_id", poolPlayerId);
  } else {
    // Upcoming: outgoing → available, incoming → selected (no play count change)
    await admin
      .from("session_players")
      .update({ status: "available" })
      .eq("session_id", sessionId)
      .eq("user_id", courtPlayerId);

    await admin
      .from("session_players")
      .update({ status: "selected" })
      .eq("session_id", sessionId)
      .eq("user_id", poolPlayerId);
  }

  return NextResponse.json({ ok: true, type: "court_to_pool" });
}
