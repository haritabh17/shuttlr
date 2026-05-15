import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSessionCapacity } from "@/lib/club-plan";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Only managers can create sessions" }, { status: 403 });
  }

  const capacity = await assertSessionCapacity(clubId);
  if (!capacity.ok) {
    return NextResponse.json({ error: capacity.error }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    playTime,
    restTime,
    selectionInterval,
    numberOfCourts,
    mixedRatio,
    skillBalance,
    partnerVariety,
    strictGender,
  } = body;

  if (selectionInterval >= playTime) {
    return NextResponse.json(
      { error: "Selection interval must be less than play time" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: session, error } = await admin
    .from("sessions")
    .insert({
      club_id: clubId,
      name: (name || "Session").trim(),
      play_time_minutes: playTime,
      rest_time_minutes: restTime,
      selection_interval_minutes: selectionInterval,
      number_of_courts: numberOfCourts,
      mixed_ratio: mixedRatio,
      skill_balance: skillBalance,
      partner_variety: partnerVariety,
      strict_gender: strictGender,
      status: "draft",
    } as any)
    .select("id")
    .single();

  if (error || !session) {
    return NextResponse.json({ error: error?.message ?? "Failed to create session" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessionId: session.id });
}
