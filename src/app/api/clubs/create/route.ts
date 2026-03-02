import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const FREE_CLUB_LIMIT = 3;
const PRO_CLUB_LIMIT = 10;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, visibility } = await request.json();
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Club name is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Count clubs this user manages (active membership, manager role, non-deleted clubs)
  const { data: managedClubs, error: countErr } = await (admin as any)
    .from("club_members")
    .select("club_id, clubs!inner(id, deleted_at)")
    .eq("user_id", user.id)
    .eq("role", "manager")
    .eq("status", "active")
    .is("clubs.deleted_at", null);

  if (countErr) {
    return NextResponse.json({ error: "Failed to check club count" }, { status: 500 });
  }

  const managedCount = managedClubs?.length ?? 0;

  // Check if any managed club has a Pro subscription
  let hasPro = false;
  if (managedCount > 0) {
    const clubIds = managedClubs!.map((m: any) => m.club_id);
    const { data: subs } = await (admin as any)
      .from("club_subscriptions")
      .select("club_id, status")
      .in("club_id", clubIds)
      .in("status", ["active", "trialing"]);

    hasPro = (subs?.length ?? 0) > 0;
  }

  const limit = hasPro ? PRO_CLUB_LIMIT : FREE_CLUB_LIMIT;

  if (managedCount >= limit) {
    return NextResponse.json({
      error: `You can manage up to ${limit} clubs${hasPro ? "" : " on the free plan. Upgrade to Pro for up to " + PRO_CLUB_LIMIT}`,
    }, { status: 403 });
  }

  // Generate slug
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    + "-" + Date.now().toString(36);

  // Create club
  const { data: club, error: clubError } = await admin
    .from("clubs")
    .insert({
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      visibility: visibility || "public",
      created_by: user.id,
    })
    .select("id, slug")
    .single();

  if (clubError) {
    return NextResponse.json({ error: clubError.message }, { status: 500 });
  }

  // Add creator as manager
  const { error: memberError } = await admin
    .from("club_members")
    .insert({
      club_id: club.id,
      user_id: user.id,
      role: "manager",
      status: "active",
    });

  if (memberError) {
    // Rollback club creation
    await admin.from("clubs").delete().eq("id", club.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug: club.slug });
}
