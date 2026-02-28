import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Add players to session
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { playerIds } = await request.json();
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return NextResponse.json({ error: "playerIds required" }, { status: 400 });
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("club_id")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", session.club_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!membership) {
    return NextResponse.json({ error: "Not a club member" }, { status: 403 });
  }

  // Non-managers can only add themselves
  const isSelfOnly = playerIds.length === 1 && playerIds[0] === user.id;
  if (membership.role !== "manager" && !isSelfOnly) {
    return NextResponse.json({ error: "You can only add yourself" }, { status: 403 });
  }

  const admin = createAdminClient();
  const rows = playerIds.map((pid: string) => ({
    session_id: sessionId,
    user_id: pid,
    status: "available" as const,
    play_count: 0,
  }));

  const { error } = await admin.from("session_players").upsert(rows, {
    onConflict: "session_id,user_id",
    ignoreDuplicates: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, added: playerIds.length });
}

// Remove player from session
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { playerId } = await request.json();

  const { data: session } = await supabase
    .from("sessions")
    .select("club_id")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", session.club_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!membership) {
    return NextResponse.json({ error: "Not a club member" }, { status: 403 });
  }

  // Non-managers can only remove themselves
  if (membership.role !== "manager" && playerId !== user.id) {
    return NextResponse.json({ error: "You can only remove yourself" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Check if player is currently playing
  const { data: sessionPlayer } = await admin
    .from("session_players")
    .select("status")
    .eq("session_id", sessionId)
    .eq("user_id", playerId)
    .single();

  if (sessionPlayer?.status === "playing") {
    // Mark as removed — they finish current game but won't be selected next round
    await admin
      .from("session_players")
      .update({ status: "removed" })
      .eq("session_id", sessionId)
      .eq("user_id", playerId);

    return NextResponse.json({ ok: true, note: "Will be removed after current game" });
  }

  await admin
    .from("session_players")
    .update({ status: "removed" })
    .eq("session_id", sessionId)
    .eq("user_id", playerId);

  return NextResponse.json({ ok: true });
}
