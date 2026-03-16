import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

const INVITE_EXPIRY_DAYS = 7;

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
    return NextResponse.json({ error: "Only managers can send invites" }, { status: 403 });
  }

  const { memberId, email } = await request.json();

  if (!memberId || !email?.trim()) {
    return NextResponse.json({ error: "memberId and email are required" }, { status: 400 });
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  // Check member belongs to this club
  const { data: member } = await admin
    .from("club_members")
    .select("id, user_id, invited_name, status")
    .eq("id", memberId)
    .eq("club_id", clubId)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Check email not already used by another member in this club
  const { data: emailConflict } = await admin
    .from("club_members")
    .select("id, invited_name")
    .eq("club_id", clubId)
    .eq("invited_email", trimmedEmail)
    .neq("id", memberId)
    .in("status", ["active", "invited"])
    .limit(1);

  if (emailConflict && emailConflict.length > 0) {
    return NextResponse.json({
      error: `This email is already used by ${emailConflict[0].invited_name || "another member"} in this club`
    }, { status: 409 });
  }

  // Check if email is used by another profile (global duplicate check)
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", trimmedEmail)
    .single();

  // If profile exists and is already linked to a different member in this club, reject
  if (existingProfile) {
    const { data: profileMember } = await admin
      .from("club_members")
      .select("id, invited_name")
      .eq("club_id", clubId)
      .eq("user_id", existingProfile.id)
      .neq("id", memberId)
      .in("status", ["active", "invited"])
      .limit(1);

    if (profileMember && profileMember.length > 0) {
      return NextResponse.json({
        error: `A user with this email is already a member (${profileMember[0].invited_name || "unknown"})`
      }, { status: 409 });
    }
  }

  // Invalidate any existing invites for this member
  await admin
    .from("club_invites" as any)
    .update({ used_at: new Date().toISOString() })
    .eq("member_id", memberId)
    .is("used_at", null);

  // Generate token
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Create invite
  const { error: inviteErr } = await admin
    .from("club_invites" as any)
    .insert({
      club_id: clubId,
      member_id: memberId,
      email: trimmedEmail,
      token,
      expires_at: expiresAt,
    });

  if (inviteErr) {
    return NextResponse.json({ error: inviteErr.message }, { status: 500 });
  }

  // Update invited_email on member
  await admin
    .from("club_members")
    .update({ invited_email: trimmedEmail })
    .eq("id", memberId);

  // Get club name for email
  const { data: club } = await admin
    .from("clubs")
    .select("name")
    .eq("id", clubId)
    .single();

  // Get manager name
  const { data: managerProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Send invitation email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shuttlrs.com";
  const inviteUrl = `${appUrl}/invite/${token}`;

  await sendInviteEmail({
    to: trimmedEmail,
    clubName: club?.name || "a club",
    managerName: managerProfile?.full_name || "A manager",
    playerName: member.invited_name || "Player",
    inviteUrl,
  });

  return NextResponse.json({ ok: true, expiresAt, inviteUrl });
}

async function sendInviteEmail({
  to,
  clubName,
  managerName,
  playerName,
  inviteUrl,
}: {
  to: string;
  clubName: string;
  managerName: string;
  playerName: string;
  inviteUrl: string;
}) {
  // Use Supabase Edge Function or a simple email service
  // For now, use Supabase auth admin to send a custom email via the auth system
  // Alternatively, we can use a simple fetch to an email API

  // Using Supabase's built-in email via auth.admin.generateLink
  // This generates a magic link but we'll use our own invite URL instead
  // For MVP: log the invite URL (manager can share manually) and try sending via Resend/etc
  
  // Try sending via the app's existing push notification email endpoint or a simple SMTP
  // For now, we'll use a lightweight approach - try fetch to a serverless email endpoint
  
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "shuttlrs <noreply@shuttlrs.com>",
          to: [to],
          subject: `You've been invited to ${clubName} on shuttlrs`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #0d9488;">🏸 shuttlrs</h2>
              <p>Hi ${playerName},</p>
              <p><strong>${managerName}</strong> has invited you to join <strong>${clubName}</strong> on shuttlrs — a badminton club management app.</p>
              <p>Click the button below to accept the invitation and link your account:</p>
              <a href="${inviteUrl}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Join Club</a>
              <p style="color: #888; font-size: 14px;">This invitation expires in 7 days.</p>
              <p style="color: #888; font-size: 14px;">If you didn't expect this, you can safely ignore this email.</p>
            </div>
          `,
        }),
      });
    } catch (err) {
      console.error("Failed to send invite email:", err);
      // Don't fail the invite if email fails — manager can share link manually
    }
  } else {
    console.log(`[INVITE] No RESEND_API_KEY — invite URL for ${to}: ${inviteUrl}`);
  }
}
