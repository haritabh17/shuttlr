import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get all clubs where user is an active member
  const { data: memberships } = await admin
    .from("club_members")
    .select("id, club_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");

  // Check each club for manager constraints
  for (const membership of memberships ?? []) {
    if (membership.role === "manager") {
      // Count other managers in this club
      const { data: otherManagers } = await admin
        .from("club_members")
        .select("id")
        .eq("club_id", membership.club_id)
        .eq("role", "manager")
        .eq("status", "active")
        .neq("user_id", user.id);

      // Count other members (any role)
      const { data: otherMembers } = await admin
        .from("club_members")
        .select("id")
        .eq("club_id", membership.club_id)
        .eq("status", "active")
        .neq("user_id", user.id);

      if ((otherMembers?.length ?? 0) > 0 && (otherManagers?.length ?? 0) === 0) {
        // Last manager but club has other members — block
        const { data: club } = await admin
          .from("clubs")
          .select("name")
          .eq("id", membership.club_id)
          .single();

        return NextResponse.json({
          error: `You're the only manager of "${club?.name}". Promote another member to manager before deleting your account.`,
        }, { status: 400 });
      }

      if ((otherMembers?.length ?? 0) === 0) {
        // Last member — soft-delete the club
        await admin
          .from("clubs")
          .update({ deleted_at: new Date().toISOString() } as any)
          .eq("id", membership.club_id);
      }
    } else {
      // Non-manager: check if they're the last member
      const { data: otherMembers } = await admin
        .from("club_members")
        .select("id")
        .eq("club_id", membership.club_id)
        .eq("status", "active")
        .neq("user_id", user.id);

      if ((otherMembers?.length ?? 0) === 0) {
        // Last member — soft-delete the club
        await admin
          .from("clubs")
          .update({ deleted_at: new Date().toISOString() } as any)
          .eq("id", membership.club_id);
      }
    }
  }

  // 1. Remove from all clubs
  await admin
    .from("club_members")
    .update({ status: "removed" })
    .eq("user_id", user.id);

  // 2. Remove from all active sessions
  await admin
    .from("session_players")
    .update({ status: "removed" })
    .eq("user_id", user.id);

  // 3. Delete push subscriptions
  await (admin as any)
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id);

  // 4. Anonymise profile
  await admin
    .from("profiles")
    .update({
      full_name: "Deleted User",
      email: null,
      avatar_url: null,
      gender: null,
      telegram_id: null,
      terms_accepted_at: null,
    } as any)
    .eq("id", user.id);

  // 5. Delete the auth user
  await admin.auth.admin.deleteUser(user.id);

  return NextResponse.json({ success: true });
}
