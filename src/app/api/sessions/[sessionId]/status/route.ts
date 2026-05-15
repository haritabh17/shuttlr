import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertConcurrentSessions } from "@/lib/club-plan";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status: newStatus, pausedElapsedMs, pausedPhase } = await request.json();
  if (!newStatus) {
    return NextResponse.json({ error: "status required" }, { status: 400 });
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
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

  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Only managers can update session status" }, { status: 403 });
  }

  if (newStatus === "running" && session.status !== "running") {
    const concurrent = await assertConcurrentSessions(session.club_id, sessionId);
    if (!concurrent.ok) {
      return NextResponse.json({ error: concurrent.error }, { status: 403 });
    }
  }

  const admin = createAdminClient();
  const updates: Record<string, unknown> = { status: newStatus };

  if (newStatus === "running" && session.status === "initiated") {
    updates.started_at = new Date().toISOString();
    updates.current_phase = "idle";
  }
  if (newStatus === "running" && (session.status === "paused" || session.status === "ended")) {
    if (pausedElapsedMs && session.status === "paused") {
      updates.current_round_started_at = new Date(Date.now() - pausedElapsedMs).toISOString();
      updates.current_phase = pausedPhase || "playing";
      updates.paused_phase = null;
    } else {
      updates.started_at = new Date().toISOString();
      updates.current_round_started_at = new Date().toISOString();
    }
    updates.ended_at = null;
    updates.paused_elapsed_ms = null;
  }
  if (newStatus === "paused") {
    updates.paused_phase = (session as any).current_phase || "playing";
    updates.current_phase = "idle";
    if (pausedElapsedMs != null) updates.paused_elapsed_ms = pausedElapsedMs;
  }
  if (newStatus === "ended") {
    updates.ended_at = new Date().toISOString();
    updates.current_phase = "idle";
  }

  const { error } = await admin.from("sessions").update(updates as any).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
