import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ImportRow {
  name: string;
  gender: string;
  level: number;
  email?: string | null;
}

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
    return NextResponse.json({ error: "Only managers can import members" }, { status: 403 });
  }

  const body = await request.json();
  const rows: ImportRow[] = body.members;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No members to import" }, { status: 400 });
  }

  if (rows.length > 200) {
    return NextResponse.json({ error: "Maximum 200 members per import" }, { status: 400 });
  }

  // Fetch existing members for duplicate detection
  const { data: existingMembers } = await admin
    .from("club_members")
    .select("user_id, invited_email, invited_name, status")
    .eq("club_id", clubId)
    .in("status", ["active", "invited"]);

  const existingEmails = new Set(
    (existingMembers ?? [])
      .map((m) => m.invited_email?.toLowerCase())
      .filter(Boolean)
  );
  const existingNames = new Set(
    (existingMembers ?? [])
      .map((m) => m.invited_name?.toLowerCase())
      .filter(Boolean)
  );

  const results = {
    imported: 0,
    skipped: [] as { name: string; reason: string }[],
    errors: [] as { name: string; reason: string }[],
  };

  for (const row of rows) {
    const trimmedName = row.name?.trim();
    const trimmedEmail = row.email?.trim() || null;
    const gender = normalizeGender(row.gender);
    const level = row.level;

    // Validate
    if (!trimmedName) {
      results.errors.push({ name: row.name || "(empty)", reason: "Name is required" });
      continue;
    }
    if (!gender) {
      results.errors.push({ name: trimmedName, reason: "Gender must be M or F" });
      continue;
    }
    if (!level || level < 1 || level > 10) {
      results.errors.push({ name: trimmedName, reason: "Level must be between 1 and 10" });
      continue;
    }

    // Check duplicates
    if (trimmedEmail && existingEmails.has(trimmedEmail.toLowerCase())) {
      results.skipped.push({ name: trimmedName, reason: "Email already exists in club" });
      continue;
    }
    if (existingNames.has(trimmedName.toLowerCase())) {
      results.skipped.push({ name: trimmedName, reason: "Name already exists in club" });
      continue;
    }

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

    // Create phantom profile if needed
    if (!profileId) {
      const phantomId = crypto.randomUUID();
      const { error: profileErr } = await admin
        .from("profiles")
        .insert({
          id: phantomId,
          full_name: trimmedName,
          email: trimmedEmail ?? undefined,
          gender,
          level,
        } as any);

      if (profileErr) {
        results.errors.push({ name: trimmedName, reason: `Profile error: ${profileErr.message}` });
        continue;
      }
      profileId = phantomId;
    }

    // Insert club membership
    const { error: memberErr } = await admin
      .from("club_members")
      .insert({
        club_id: clubId,
        user_id: profileId,
        invited_email: trimmedEmail,
        invited_name: trimmedName,
        invited_gender: gender,
        invited_level: level,
        role: "player",
        status: "active",
      });

    if (memberErr) {
      if (!isExistingUser && profileId) {
        await admin.from("profiles").delete().eq("id", profileId);
      }
      results.errors.push({ name: trimmedName, reason: memberErr.message });
      continue;
    }

    // Track for duplicate detection within same batch
    if (trimmedEmail) existingEmails.add(trimmedEmail.toLowerCase());
    existingNames.add(trimmedName.toLowerCase());
    results.imported++;
  }

  return NextResponse.json(results);
}

function normalizeGender(g: string): "M" | "F" | null {
  if (!g) return null;
  const normalized = g.trim().toUpperCase();
  if (normalized === "M" || normalized === "MALE") return "M";
  if (normalized === "F" || normalized === "FEMALE") return "F";
  return null;
}
