"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/";
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-zinc-950">
      {/* Hero Section */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-8 py-16 lg:py-0">
        {/* Dark gradient background with subtle teal */}
        <div className="absolute inset-0 bg-gradient-to-b from-teal-900/40 via-emerald-900/30 to-zinc-950" />
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/15 via-transparent to-emerald-500/10" />

        {/* Decorative glows */}
        <div className="absolute -left-32 top-1/4 h-64 w-64 rounded-full bg-teal-500/10 blur-[100px]" />
        <div className="absolute -right-20 bottom-1/3 h-80 w-80 rounded-full bg-emerald-500/8 blur-[120px]" />

        <div className="relative z-10 max-w-md text-center">
          <div className="mb-8 flex items-center justify-center gap-3">
            <img src="/logo.png" alt="Shuttlr" className="h-12 w-12 rounded-xl" />
            <h1 className="text-3xl font-bold text-white tracking-tight">shuttlr</h1>
          </div>

          <p className="text-2xl font-semibold text-white/90 leading-snug">
            Organize your game.
          </p>
          <p className="text-2xl font-semibold text-white/60">
            Not your group chat.
          </p>

          <p className="mt-4 text-sm text-white/40 leading-relaxed max-w-sm mx-auto">
            Smart court rotation, fair player selection, and effortless session management for badminton clubs.
          </p>

          {/* Feature highlights */}
          <div className="mt-10 space-y-4 text-left max-w-sm mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 backdrop-blur-sm">
                <span className="text-base">🏸</span>
              </div>
              <span className="text-sm font-medium text-white/70">Automated court rotation & player selection</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 backdrop-blur-sm">
                <span className="text-base">⏱️</span>
              </div>
              <span className="text-sm font-medium text-white/70">Built-in session timers & round management</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 backdrop-blur-sm">
                <span className="text-base">📊</span>
              </div>
              <span className="text-sm font-medium text-white/70">Fair play tracking across all members</span>
            </div>
          </div>
        </div>
      </div>

      {/* Login Section */}
      <div className="flex flex-1 items-center justify-center px-8 py-12 lg:max-w-xl">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Sign in to manage your clubs and sessions
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:border-zinc-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-950 px-3 text-zinc-600">
                or continue with email
              </span>
            </div>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-400"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-600 transition focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-400"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-600 transition focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-950/30 border border-red-900/50 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2.5 text-sm font-semibold text-teal-400 transition hover:bg-teal-500/20 hover:border-teal-500/40 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-teal-500 hover:text-teal-400"
            >
              Sign up
            </Link>
          </p>
          <p className="text-center text-xs text-zinc-600">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="text-teal-500 hover:text-teal-400">
              Terms & Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
