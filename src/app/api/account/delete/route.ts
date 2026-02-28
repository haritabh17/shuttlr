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

  // 1. Remove from all clubs (soft delete)
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

  // 4. Anonymise profile (keep row for foreign key integrity, wipe personal data)
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

  // 5. Delete the auth user (this signs them out everywhere)
  await admin.auth.admin.deleteUser(user.id);

  return NextResponse.json({ success: true });
}
