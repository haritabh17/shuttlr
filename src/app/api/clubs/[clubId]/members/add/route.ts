import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

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
    return NextResponse.json({ error: "Only managers can add members" }, { status: 403 });
  }

  const body = await request.json();
  const { email, name, gender, level } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const trimmedEmail = email?.trim() || null;
  const trimmedName = name.trim();

  // Check if user exists by email
  let profileId: string | null = null;
  let isExistingUser = false;

  if (trimmedEmail) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", trimmedEmail)
      .single();

    if (existingProfile) {
      profileId = existingProfile.id;
      isExistingUser = true;
    }
  }

  // Check for existing membership (by user_id or email)
  if (trimmedEmail || profileId) {
    const orFilter = profileId
      ? `user_id.eq.${profileId}${trimmedEmail ? `,invited_email.eq.${trimmedEmail}` : ""}`
      : `invited_email.eq.${trimmedEmail}`;

    const { data: existing } = await admin
      .from("club_members")
      .select("id, status, invited_name")
      .eq("club_id", clubId)
      .or(orFilter)
      .single();

    if (existing) {
      if (existing.status === "removed") {
        await admin
          .from("club_members")
          .update({
            status: "active",
            role: "player",
            user_id: profileId,
            invited_name: trimmedName || existing.invited_name,
            invited_gender: gender || null,
            invited_level: level ?? null,
          })
          .eq("id", existing.id);

        return NextResponse.json({ ok: true, reactivated: true });
      }
      return NextResponse.json({ error: "This person is already a member of this club." }, { status: 409 });
    }
  }

  // If no existing profile and no email → create phantom profile
  if (!profileId) {
    const phantomId = crypto.randomUUID();
    const { error: profileErr } = await admin
      .from("profiles")
      .insert({
        id: phantomId,
        full_name: trimmedName,
        email: trimmedEmail || null,
        gender: gender || null,
        level: level ?? null,
        is_placeholder: true,
      });

    if (profileErr) {
      return NextResponse.json({ error: `Failed to create profile: ${profileErr.message}` }, { status: 500 });
    }
    profileId = phantomId;
  }

  // Insert club membership — always active since we have a profile (real or phantom)
  const { error: memberErr } = await admin
    .from("club_members")
    .insert({
      club_id: clubId,
      user_id: profileId,
      invited_email: trimmedEmail,
      invited_name: trimmedName,
      invited_gender: gender || null,
      invited_level: level ?? null,
      role: "player",
      status: "active",
    });

  if (memberErr) {
    if (!isExistingUser && profileId) {
      await admin.from("profiles").delete().eq("id", profileId);
    }
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, phantomProfile: !isExistingUser });
}
