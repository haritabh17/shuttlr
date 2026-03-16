import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ensure a club has at least `count` courts.
 * Creates missing courts, never deletes existing ones.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const { count } = await request.json();

  if (!count || count < 1) {
    return NextResponse.json({ error: "count must be >= 1" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get existing courts
  const { data: existing } = await admin
    .from("courts")
    .select("id, name")
    .eq("club_id", clubId)
    .order("name");

  const currentCount = existing?.length ?? 0;

  if (currentCount >= count) {
    return NextResponse.json({ ok: true, courts: currentCount, created: 0 });
  }

  // Create missing courts
  const toCreate = [];
  for (let i = currentCount + 1; i <= count; i++) {
    toCreate.push({ club_id: clubId, name: `Court ${i}` });
  }

  const { error } = await admin.from("courts").insert(toCreate);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, courts: count, created: toCreate.length });
}
