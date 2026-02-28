import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courtId: string }> }
) {
  const { courtId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: court } = await supabase
    .from("courts")
    .select("id, club_id, locked")
    .eq("id", courtId)
    .single();
  if (!court) return NextResponse.json({ error: "Court not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", court.club_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Manager only" }, { status: 403 });
  }

  const { error } = await supabase
    .from("courts")
    .update({ locked: !court.locked })
    .eq("id", courtId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, locked: !court.locked });
}
