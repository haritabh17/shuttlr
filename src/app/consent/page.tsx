"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function ConsentPage() {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleAccept() {
    if (!agreed) return;
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { error: updateErr } = await (supabase as any)
      .from("profiles")
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateErr) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    window.location.href = "/";
  }

  async function handleDecline() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-lg space-y-6 rounded-xl bg-zinc-900 p-8 shadow-lg">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Shuttlr" className="h-10 w-10 rounded-xl" />
          <h1 className="text-2xl font-bold text-white">Terms & Privacy</h1>
        </div>

        <p className="text-sm text-zinc-400 leading-relaxed">
          Before you continue, please review and accept our Terms of Service and Privacy Policy.
          We&apos;ve kept them short and in plain English.
        </p>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 max-h-64 overflow-y-auto">
          <div className="space-y-3 text-xs text-zinc-400 leading-relaxed">
            <p><strong className="text-zinc-300">What we collect:</strong> Name, email, gender (for court balancing), club membership, game history, and push notification tokens (if you opt in).</p>
            <p><strong className="text-zinc-300">How we use it:</strong> To run the app — court rotation, player selection, session management, and push notifications. We may display advertisements.</p>
            <p><strong className="text-zinc-300">What we don&apos;t do:</strong> We don&apos;t sell your personal data or use it to train AI models.</p>
            <p><strong className="text-zinc-300">Your rights:</strong> You can edit your profile, leave clubs, and request account deletion at any time.</p>
            <p><strong className="text-zinc-300">Data storage:</strong> Supabase (EU-West, AWS) and Vercel.</p>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 rounded border-zinc-700"
          />
          <span className="text-sm text-zinc-300">
            I have read and agree to the{" "}
            <Link href="/terms" target="_blank" className="text-teal-500 hover:text-teal-400 underline">
              Terms of Service & Privacy Policy
            </Link>
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleAccept}
            disabled={!agreed || loading}
            className="flex-1 rounded-xl bg-teal-500/20 border border-teal-500/30 px-4 py-2.5 text-sm font-semibold text-teal-400 transition hover:bg-teal-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : "Accept & Continue"}
          </button>
          <button
            onClick={handleDecline}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
