import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { memberId, email } = body;

  // Verify requester is manager
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Manager only" }, { status: 403 });
  }

  const admin = createAdminClient();

  if (memberId) {
    // Promote existing member
    const { error } = await supabase
      .from("club_members")
      .update({ role: "manager" })
      .eq("id", memberId)
      .eq("club_id", clubId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("events").insert({
      club_id: clubId,
      actor_id: user.id,
      actor_type: "human",
      event_type: "member_promoted",
      payload: { member_id: memberId },
    });

    return NextResponse.json({ ok: true });
  }

  if (email) {
    // Check if user with this email already exists as a member
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (existingProfile) {
      // Check if already a member
      const { data: existingMember } = await admin
        .from("club_members")
        .select("id, role")
        .eq("club_id", clubId)
        .eq("user_id", existingProfile.id)
        .single();

      if (existingMember) {
        if (existingMember.role === "manager") {
          return NextResponse.json({ error: "Already a manager" }, { status: 400 });
        }
        // Promote existing member
        await admin
          .from("club_members")
          .update({ role: "manager" })
          .eq("id", existingMember.id);
      } else {
        // Add as manager
        await admin.from("club_members").insert({
          club_id: clubId,
          user_id: existingProfile.id,
          role: "manager",
          status: "active",
        });
      }
    } else {
      // User hasn't signed up — create pending membership
      // Check if pending promotion already exists
      const { data: pending } = await admin
        .from("club_members")
        .select("id")
        .eq("club_id", clubId)
        .eq("invited_email", email)
        .is("user_id", null)
        .single();

      if (pending) {
        await admin
          .from("club_members")
          .update({ role: "manager" })
          .eq("id", pending.id);
      } else {
        await admin.from("club_members").insert({
          club_id: clubId,
          user_id: null,
          invited_email: email,
          role: "manager",
          status: "pending",
        } as any);
      }
    }

    await admin.from("events").insert({
      club_id: clubId,
      actor_id: user.id,
      actor_type: "human",
      event_type: "member_promoted",
      payload: { email, deferred: !existingProfile },
    });

    return NextResponse.json({ ok: true, deferred: !existingProfile });
  }

  return NextResponse.json({ error: "memberId or email required" }, { status: 400 });
}
