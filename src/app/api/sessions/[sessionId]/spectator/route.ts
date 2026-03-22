import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// PUT: Set or update spectator PIN (manager only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: session } = await supabase
    .from("sessions")
    .select("club_id")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", session.club_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Only managers can set spectator PIN" }, { status: 403 });
  }

  const { pin } = await request.json();
  if (!pin || !/^\d{4,8}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be 4-8 digits" }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin
    .from("sessions")
    .update({ spectator_pin: pin } as any)
    .eq("id", sessionId);

  return NextResponse.json({ ok: true });
}

// DELETE: Remove spectator PIN (disable sharing)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: session } = await supabase
    .from("sessions")
    .select("club_id")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", session.club_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Only managers" }, { status: 403 });
  }

  const admin = createAdminClient();
  await admin
    .from("sessions")
    .update({ spectator_pin: null } as any)
    .eq("id", sessionId);

  return NextResponse.json({ ok: true });
}

// POST: Verify PIN (public, no auth needed)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { pin } = await request.json();

  if (!pin) return NextResponse.json({ error: "PIN required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sessions")
    .select("spectator_pin")
    .eq("id", sessionId)
    .single() as { data: any };

  if (!session || !session.spectator_pin) {
    return NextResponse.json({ error: "Spectator access not enabled" }, { status: 404 });
  }

  if (session.spectator_pin !== pin) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 403 });
  }

  // Return a simple token (hash of sessionId + pin) for cookie-based validation
  const crypto = await import("crypto");
  const token = crypto.createHash("sha256").update(`${sessionId}:${pin}`).digest("hex").slice(0, 32);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(`spectator_${sessionId}`, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return response;
}
