"use client";

import { useState } from "react";
import { LIMITS } from "@/lib/limits";

interface PlanUsageCardProps {
  isPro: boolean;
  plan?: string | null;
  billingCycle?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  memberCount: number;
  totalSessions: number;
  runningSessions: number;
  clubId: string;
  clubSlug: string;
}

function UsageBar({ label, current, max, showInfinity }: { label: string; current: number; max: number; showInfinity?: boolean }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-teal-500";

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="text-zinc-300 font-medium">
          {current} / {showInfinity ? "∞" : max}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${showInfinity ? Math.min(current, 5) : pct}%` }} />
      </div>
    </div>
  );
}

export function PlanUsageCard({
  isPro,
  plan,
  billingCycle,
  currentPeriodEnd,
  trialEndsAt,
  memberCount,
  totalSessions,
  runningSessions,
  clubId,
  clubSlug,
}: PlanUsageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const limits = isPro ? LIMITS.pro : LIMITS.free;

  // Determine warnings
  const warnings: string[] = [];
  if (!isPro) {
    if (totalSessions / limits.totalSessions >= 0.8) warnings.push(`Running low on sessions (${totalSessions} / ${limits.totalSessions})`);
    if (memberCount / limits.members >= 0.8) warnings.push(`Running low on member slots (${memberCount} / ${limits.members})`);
  }

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, priceType: "monthly" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function handleManageBilling() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, clubSlug }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Warning strip */}
      {warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-950/30 border-b border-amber-900/30 text-xs text-amber-400">
          ⚠️ {warnings[0]}
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-zinc-100">Plan & Usage</h3>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            isPro ? "bg-teal-900/40 text-teal-400" : "bg-zinc-800 text-zinc-400"
          }`}>
            {isPro ? "Pro" : "Free"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isPro && !expanded && (
            <button
              onClick={(e) => { e.stopPropagation(); handleUpgrade(); }}
              disabled={loading}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-teal-700 text-teal-50 hover:bg-teal-600 disabled:opacity-50"
            >
              {loading ? "..." : "Upgrade"}
            </button>
          )}
          <span className="text-zinc-600 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4">
          {/* Pro billing info */}
          {isPro && (
            <>
              <div className="flex justify-between text-xs py-1">
                <span className="text-zinc-600">Plan</span>
                <span className="text-zinc-300">Pro {billingCycle === "yearly" ? "Yearly" : "Monthly"}</span>
              </div>
              {currentPeriodEnd && (
                <div className="flex justify-between text-xs py-1">
                  <span className="text-zinc-600">Next billing</span>
                  <span className="text-zinc-300">{new Date(currentPeriodEnd).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              )}
              {trialEndsAt && new Date(trialEndsAt) > new Date() && (
                <div className="flex justify-between text-xs py-1">
                  <span className="text-zinc-600">Trial ends</span>
                  <span className="text-zinc-300">{new Date(trialEndsAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              )}
              <div className="h-px bg-zinc-800 my-3" />
            </>
          )}

          {/* Usage bars */}
          <UsageBar label="Total sessions" current={totalSessions} max={limits.totalSessions} />
          <UsageBar label="Members" current={memberCount} max={limits.members} />
          <UsageBar label="Concurrent games" current={runningSessions} max={limits.concurrentSessions} />

          {/* Plan comparison (free only) */}
          {!isPro && (
            <>
              <div className="h-px bg-zinc-800 my-3" />
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-1 text-zinc-600 font-semibold"></th>
                    <th className="text-center py-1 text-zinc-600 font-semibold">Free</th>
                    <th className="text-center py-1 text-teal-500 font-semibold">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1.5 text-zinc-400">Total sessions</td>
                    <td className="text-center text-zinc-500">{LIMITS.free.totalSessions}</td>
                    <td className="text-center text-teal-400 font-medium">{LIMITS.pro.totalSessions}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-zinc-400">Members</td>
                    <td className="text-center text-zinc-500">{LIMITS.free.members}</td>
                    <td className="text-center text-teal-400 font-medium">{LIMITS.pro.members}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-zinc-400">Clubs managed</td>
                    <td className="text-center text-zinc-500">{LIMITS.free.clubs}</td>
                    <td className="text-center text-teal-400 font-medium">{LIMITS.pro.clubs}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-zinc-400">Concurrent games</td>
                    <td className="text-center text-zinc-500">{LIMITS.free.concurrentSessions}</td>
                    <td className="text-center text-teal-400 font-medium">{LIMITS.pro.concurrentSessions}</td>
                  </tr>
                </tbody>
              </table>

              <button
                onClick={handleUpgrade}
                disabled={loading}
                className={`w-full mt-3 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${
                  warnings.length > 0
                    ? "bg-amber-600 text-white hover:bg-amber-500"
                    : "bg-teal-700 text-teal-50 hover:bg-teal-600"
                }`}
              >
                {loading ? "..." : warnings.length > 0 ? "Upgrade to remove limits — €2.99/mo" : "Upgrade to Pro — €2.99/mo"}
              </button>
            </>
          )}

          {/* Pro: manage billing */}
          {isPro && (
            <button
              onClick={handleManageBilling}
              disabled={loading}
              className="w-full mt-3 py-2 rounded-lg text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition disabled:opacity-50"
            >
              {loading ? "..." : "Manage Billing →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
