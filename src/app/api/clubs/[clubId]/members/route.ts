import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { memberId, role } = await request.json();
  if (!memberId || !["manager", "player"].includes(role)) {
    return NextResponse.json({ error: "memberId and valid role required" }, { status: 400 });
  }

  await supabase
    .from("club_members")
    .update({ role })
    .eq("id", memberId)
    .eq("club_id", clubId);

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check manager
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { memberId, nickname, gender, level } = body;

  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }

  if (level !== undefined && (typeof level !== "number" || level < 1 || level > 10)) {
    return NextResponse.json({ error: "Level must be between 1 and 10" }, { status: 400 });
  }

  // Get the member to find their user_id
  const { data: member } = await supabase
    .from("club_members")
    .select("user_id")
    .eq("id", memberId)
    .eq("club_id", clubId)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Update club-specific fields on club_members
  const memberUpdates: Record<string, unknown> = {};
  if (nickname !== undefined) memberUpdates.nickname = nickname;
  if (gender !== undefined) memberUpdates.invited_gender = gender;
  if (level !== undefined) memberUpdates.invited_level = level;

  if (Object.keys(memberUpdates).length > 0) {
    await supabase.from("club_members").update(memberUpdates as any).eq("id", memberId);
  }

  // Update gender on profile (gender is global, level is club-specific)
  if (member.user_id && gender !== undefined) {
    const admin = createAdminClient();
    await admin.from("profiles").update({ gender }).eq("id", member.user_id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check manager
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");

  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }

  // Soft-remove: set status to 'removed'
  await supabase
    .from("club_members")
    .update({ status: "removed" })
    .eq("id", memberId)
    .eq("club_id", clubId);

  return NextResponse.json({ ok: true });
}
