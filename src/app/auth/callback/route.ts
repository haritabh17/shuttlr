import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Prevent open redirect: only allow relative paths starting with /
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      // Beta whitelist: only allow specific emails
      const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (allowedEmails.length > 0 && (!user?.email || !allowedEmails.includes(user.email.toLowerCase()))) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=access_denied`);
      }

      // Claim any pending club memberships by email
      if (user?.email) {
        const admin = createAdminClient();
        await admin
          .from("club_members")
          .update({ user_id: user.id, status: "active" } as any)
          .eq("invited_email", user.email)
          .is("user_id", null);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
