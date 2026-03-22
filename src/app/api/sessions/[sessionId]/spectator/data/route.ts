import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const admin = createAdminClient();

  // Verify spectator token from cookie
  const cookieStore = await cookies();
  const token = cookieStore.get(`spectator_${sessionId}`)?.value;

  const { data: session } = await admin
    .from("sessions")
    .select("*, club:clubs(name, slug)")
    .eq("id", sessionId)
    .single() as { data: any };

  if (!session || !session.spectator_pin) {
    return NextResponse.json({ error: "Spectator access not enabled" }, { status: 404 });
  }

  const expectedToken = crypto
    .createHash("sha256")
    .update(`${sessionId}:${session.spectator_pin}`)
    .digest("hex")
    .slice(0, 32);

  if (token !== expectedToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Fetch session data (same as what non-manager members see)
  const { data: courts } = await admin
    .from("courts")
    .select("*")
    .eq("club_id", session.club_id)
    .order("name");

  const sessionCourts = (courts ?? []).slice(0, session.number_of_courts);

  // Current round assignments
  const { data: assignments } = await admin
    .from("court_assignments")
    .select(`
      id,
      court_id,
      round,
      assignment_status,
      user:profiles (
        id,
        full_name,
        gender
      )
    `)
    .eq("session_id", sessionId)
    .in("assignment_status", ["active", "upcoming"]) as { data: any };

  // Session players for the pool
  const { data: sessionPlayers } = await admin
    .from("session_players")
    .select(`
      id,
      status,
      play_count,
      user:profiles (
        id,
        full_name,
        gender
      )
    `)
    .eq("session_id", sessionId) as { data: any };

  // Get nicknames from club_members
  const { data: clubMembers } = await (admin as any)
    .from("club_members")
    .select("user_id, nickname")
    .eq("club_id", session.club_id)
    .in("status", ["active", "invited"]);

  const nicknameMap: Record<string, string> = {};
  for (const cm of clubMembers ?? []) {
    if (cm.user_id && cm.nickname) nicknameMap[cm.user_id] = cm.nickname;
  }

  return NextResponse.json({
    session: {
      id: session.id,
      name: session.name,
      status: session.status,
      clubName: session.club?.name,
      numberOfCourts: session.number_of_courts,
      playTimeMinutes: session.play_time_minutes,
      currentRoundStartedAt: session.current_round_started_at,
      currentPhase: session.current_phase,
      startedAt: session.started_at,
      endedAt: session.ended_at,
    },
    courts: sessionCourts.map((c: any) => ({ id: c.id, name: c.name, locked: c.locked })),
    assignments: (assignments ?? []).map((a: any) => ({
      id: a.id,
      courtId: a.court_id,
      round: a.round,
      status: a.assignment_status,
      player: a.user ? {
        id: a.user.id,
        name: nicknameMap[a.user.id] || a.user.full_name,
        gender: a.user.gender,
      } : null,
    })),
    players: (sessionPlayers ?? []).map((sp: any) => ({
      id: sp.user?.id,
      name: sp.user ? (nicknameMap[sp.user.id] || sp.user.full_name) : "Unknown",
      gender: sp.user?.gender,
      status: sp.status,
      playCount: sp.play_count,
    })),
  });
}
