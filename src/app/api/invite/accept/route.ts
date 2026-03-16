import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in to accept an invitation" }, { status: 401 });

  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  // Look up invite
  const { data: invite } = await admin
    .from("club_invites" as any)
    .select("id, club_id, member_id, email, expires_at, used_at")
    .eq("token", token)
    .single() as { data: any };

  if (!invite) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
  }

  if (invite.used_at) {
    return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
  }

  // Get the member record
  const { data: member } = await admin
    .from("club_members")
    .select("id, user_id, club_id")
    .eq("id", invite.member_id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Member record not found" }, { status: 404 });
  }

  const phantomId = member.user_id;
  const realUserId = user.id;

  // Check if this user is already a member of this club
  if (phantomId !== realUserId) {
    const { data: existingMember } = await admin
      .from("club_members")
      .select("id")
      .eq("club_id", invite.club_id)
      .eq("user_id", realUserId)
      .in("status", ["active", "invited"])
      .single();

    if (existingMember) {
      // User already in club — just mark invite as used
      await admin
        .from("club_invites" as any)
        .update({ used_at: new Date().toISOString() })
        .eq("id", invite.id);

      return NextResponse.json({ ok: true, alreadyMember: true });
    }
  }

  // Merge phantom profile into real user
  if (phantomId && phantomId !== realUserId) {
    // Check if phantom is actually a placeholder
    const { data: phantomProfile } = await admin
      .from("profiles")
      .select("id, is_placeholder" as any)
      .eq("id", phantomId)
      .single() as { data: any };

    if (phantomProfile) {
      // Update all references from phantom → real user

      // 1. club_members: swap user_id
      await admin
        .from("club_members")
        .update({ user_id: realUserId, status: "active" })
        .eq("id", member.id);

      // 2. session_players: swap user_id
      await admin
        .from("session_players")
        .update({ user_id: realUserId })
        .eq("user_id", phantomId);

      // 3. court_assignments: swap user_id
      await admin
        .from("court_assignments")
        .update({ user_id: realUserId })
        .eq("user_id", phantomId);

      // 4. partner_history: swap both player1_id and player2_id
      await admin
        .from("partner_history" as any)
        .update({ player1_id: realUserId })
        .eq("player1_id", phantomId);
      await admin
        .from("partner_history" as any)
        .update({ player2_id: realUserId })
        .eq("player2_id", phantomId);

      // 5. events: swap actor_id
      await admin
        .from("events" as any)
        .update({ actor_id: realUserId })
        .eq("actor_id", phantomId);

      // 6. Delete phantom profile (only if it's a placeholder)
      if (phantomProfile.is_placeholder) {
        await admin.from("profiles").delete().eq("id", phantomId);
      }
    }
  } else {
    // No phantom — just ensure member is active
    await admin
      .from("club_members")
      .update({ status: "active" })
      .eq("id", member.id);
  }

  // Mark invite as used
  await admin
    .from("club_invites" as any)
    .update({ used_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true });
}
