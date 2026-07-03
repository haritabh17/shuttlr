import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  acquireSessionLock,
  releaseSessionLock,
  runSelection,
  type PushGroup,
} from "@shared/selection-run";
import { sendPushToUsers } from "@/lib/push";

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

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

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

  const admin = createAdminClient();

  if (!(await acquireSessionLock(admin, sessionId))) {
    return NextResponse.json({ error: "Selection already in progress" }, { status: 409 });
  }

  const sendPush = async (group: PushGroup) => {
    try {
      await sendPushToUsers({
        userIds: group.userIds,
        title: group.title,
        body: group.body,
        url: group.url,
        tag: group.tag,
      });
    } catch (err) {
      console.error(`[select] push failed for session ${sessionId}:`, err);
    }
  };

  try {
    const result = await runSelection(
      { supabase: admin, sendPush },
      session,
      "active",
      user.id
    );

    if (!result.ok) {
      const message =
        result.reason === "no_players"
          ? "No available players"
          : result.reason === "no_courts"
            ? "No unlocked courts available"
            : "Could not form any courts";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ round: result.round, courts: result.courts });
  } finally {
    await releaseSessionLock(admin, sessionId);
  }
}
