import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const TERMS_LAST_UPDATED = "2026-02-28T00:00:00Z";
// Caches a passed terms check so we don't query profiles on every navigation.
// Value is `${userId}:${TERMS_LAST_UPDATED}`, so it invalidates when the terms
// change or a different user signs in on the same browser.
const TERMS_COOKIE = "terms_ok";

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

  // Beta whitelist only applies on beta.shuttlrs.com
  const isBeta = request.nextUrl.hostname.includes("beta.");

  if (
    isBeta &&
    allowedEmails.length > 0 &&
    user?.email &&
    !allowedEmails.includes(user.email.toLowerCase()) &&
    !isPublicRoute
  ) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=access_denied", request.url));
  }

  // Check terms acceptance — redirect to /consent if not accepted or outdated
  if (user && !isPublicRoute) {
    const termsCookie = request.cookies.get(TERMS_COOKIE)?.value;
    const expectedCookie = `${user.id}:${TERMS_LAST_UPDATED}`;

    if (termsCookie !== expectedCookie) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("terms_accepted_at")
        .eq("id", user.id)
        .single();

      const acceptedAt = profile?.terms_accepted_at;
      if (!acceptedAt || new Date(acceptedAt) < new Date(TERMS_LAST_UPDATED)) {
        return NextResponse.redirect(new URL("/consent", request.url));
      }

      supabaseResponse.cookies.set(TERMS_COOKIE, expectedCookie, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip /api entirely — API routes authenticate themselves, and running
    // auth.getUser() there added a Supabase round-trip to every call
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
