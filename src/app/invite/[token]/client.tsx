"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function InviteAcceptClient({
  token,
  isLoggedIn,
  userName,
  clubSlug,
}: {
  token: string;
  isLoggedIn: boolean;
  userName: string;
  clubSlug: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(!isLoggedIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [fullName, setFullName] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleAccept() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to accept invitation");
        setLoading(false);
        return;
      }

      router.push(`/clubs/${clubSlug}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/invite/${token}`,
      },
    });
    if (error) setError(error.message);
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isSignup) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/invite/${token}`,
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // After signup, they may need to confirm email — refresh page
      router.refresh();
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // Now logged in — refresh to show accept button
      router.refresh();
    }
  }

  if (isLoggedIn) {
    return (
      <div className="text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          Signed in as <strong className="text-zinc-900 dark:text-zinc-100">{userName}</strong>
        </p>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <button
          onClick={handleAccept}
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-teal-600 px-6 py-3 text-lg font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? "Joining..." : "Accept & Join Club"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-center text-zinc-600 dark:text-zinc-400 mb-6">
        Sign in or create an account to join
      </p>

      <button
        onClick={handleGoogleSignIn}
        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 flex items-center justify-center gap-3"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <div className="my-4 flex items-center gap-3">
        <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
        <span className="text-xs text-zinc-400">or</span>
        <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
      </div>

      <form onSubmit={handleEmailAuth} className="space-y-3">
        {isSignup && (
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            required
            className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={6}
          className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? "..." : isSignup ? "Sign Up & Join" : "Sign In & Join"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500">
        {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          onClick={() => { setIsSignup(!isSignup); setError(null); }}
          className="text-teal-600 hover:underline"
        >
          {isSignup ? "Sign in" : "Sign up"}
        </button>
      </p>
    </div>
  );
}
