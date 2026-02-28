import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser();

  // Beta whitelist: block non-whitelisted users from accessing the app
  const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const isPublicRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/auth") ||
    request.nextUrl.pathname.startsWith("/terms") ||
    request.nextUrl.pathname.startsWith("/consent");

  if (
    allowedEmails.length > 0 &&
    user?.email &&
    !allowedEmails.includes(user.email.toLowerCase()) &&
    !isPublicRoute
  ) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=access_denied", request.url));
  }

  // Check terms acceptance — redirect to /consent if not accepted or outdated
  const TERMS_LAST_UPDATED = "2026-02-28T00:00:00Z";

  if (user && !isPublicRoute) {
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("terms_accepted_at")
      .eq("id", user.id)
      .single();

    const acceptedAt = profile?.terms_accepted_at;
    if (!acceptedAt || new Date(acceptedAt) < new Date(TERMS_LAST_UPDATED)) {
      return NextResponse.redirect(new URL("/consent", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
