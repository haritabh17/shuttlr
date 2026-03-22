import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get session + verify manager
  const { data: session } = await admin
    .from("sessions")
    .select("id, club_id, status")
    .eq("id", sessionId)
    .single();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: membership } = await admin
    .from("club_members")
    .select("role")
    .eq("club_id", session.club_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Only managers can reshuffle" }, { status: 403 });
  }

  // Find the current max round so we only discard the current round, not history
  const { data: maxRoundRow } = await admin
    .from("court_assignments")
    .select("round")
    .eq("session_id", sessionId)
    .order("round", { ascending: false })
    .limit(1);

  const currentRound = maxRoundRow?.[0]?.round ?? 0;

  // Delete only the current round's active assignments + all upcoming
  if (currentRound > 0) {
    await admin
      .from("court_assignments")
      .delete()
      .eq("session_id", sessionId)
      .eq("assignment_status", "active")
      .eq("round", currentRound);
  }

  await admin
    .from("court_assignments")
    .delete()
    .eq("session_id", sessionId)
    .eq("assignment_status", "upcoming");

  // Reset playing players to available (no play_count decrement needed —
  // count is only incremented at next round's selection, not at assignment time)
  await admin
    .from("session_players")
    .update({ status: "available" })
    .eq("session_id", sessionId)
    .eq("status", "playing");

  // Reset selected players too
  await admin
    .from("session_players")
    .update({ status: "available" })
    .eq("session_id", sessionId)
    .eq("status", "selected");

  // Reset session phase
  await admin
    .from("sessions")
    .update({
      current_phase: "idle",
      current_round_started_at: null,
      selecting: false,
      next_round_selected: false,
    } as any)
    .eq("id", sessionId);

  return NextResponse.json({ ok: true });
}
