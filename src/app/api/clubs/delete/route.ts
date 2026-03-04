import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clubId } = await request.json();
  if (!clubId) return NextResponse.json({ error: "Missing clubId" }, { status: 400 });

  const admin = createAdminClient();

  // Verify user is manager of this club
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Only managers can delete a club" }, { status: 403 });
  }

  // Check for other active members
  const { data: otherMembers } = await admin
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("status", "active")
    .neq("user_id", user.id);

  if (otherMembers && otherMembers.length > 0) {
    return NextResponse.json({
      error: `Cannot delete — ${otherMembers.length} other active member${otherMembers.length > 1 ? "s" : ""} remain. Remove them first.`,
    }, { status: 409 });
  }

  // Cancel Stripe subscription if active
  const { data: sub } = await (admin as any)
    .from("club_subscriptions")
    .select("stripe_subscription_id, status")
    .eq("club_id", clubId)
    .single();

  if (sub?.stripe_subscription_id && ["active", "past_due"].includes(sub.status)) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    } catch {
      // Already canceled or doesn't exist — continue
    }
  }

  // Soft delete the club
  const { error } = await admin
    .from("clubs")
    .update({ deleted_at: new Date().toISOString() } as any)
    .eq("id", clubId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Deactivate the manager's own membership
  await admin
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
