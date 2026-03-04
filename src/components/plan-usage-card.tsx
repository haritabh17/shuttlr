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
        <span className="text-teal-700 dark:text-teal-400">{label}</span>
        <span className="text-teal-900 dark:text-teal-200 font-medium">
          {current} / {showInfinity ? "∞" : max}
        </span>
      </div>
      <div className="h-1.5 bg-teal-200 dark:bg-teal-800 rounded-full overflow-hidden">
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
        body: JSON.stringify({ clubId, billingCycle: "monthly" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Upgrade failed — please try again");
      }
    } catch (err) {
      alert("Network error — please try again");
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
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Upgrade failed — please try again");
      }
    } catch (err) {
      alert("Network error — please try again");
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 overflow-hidden dark:border-teal-900 dark:bg-teal-950">
      {/* Warning strip */}
      {warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-100 border-b border-amber-200 text-xs text-amber-700 dark:bg-amber-950/30 dark:border-amber-900/30 dark:text-amber-400">
          ⚠️ {warnings[0]}
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-teal-100/50 dark:hover:bg-teal-900/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-teal-900 dark:text-teal-100">Plan & Usage</h3>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            isPro ? "bg-teal-200 text-teal-800 dark:bg-teal-800 dark:text-teal-200" : "bg-teal-200/60 text-teal-700 dark:bg-teal-900/60 dark:text-teal-400"
          }`}>
            {isPro ? "Pro" : "Free"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isPro && !expanded && (
            <button
              onClick={(e) => { e.stopPropagation(); handleUpgrade(); }}
              disabled={loading}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? "..." : "Upgrade"}
            </button>
          )}
          <span className="text-teal-400 dark:text-teal-600 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4">
          {/* Pro billing info */}
          {isPro && (
            <>
              <div className="flex justify-between text-xs py-1">
                <span className="text-teal-600 dark:text-teal-500">Plan</span>
                <span className="text-teal-900 dark:text-teal-200">Pro {billingCycle === "yearly" ? "Yearly" : "Monthly"}</span>
              </div>
              {currentPeriodEnd && (
                <div className="flex justify-between text-xs py-1">
                  <span className="text-teal-600 dark:text-teal-500">Next billing</span>
                  <span className="text-teal-900 dark:text-teal-200">{new Date(currentPeriodEnd).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              )}
              {trialEndsAt && new Date(trialEndsAt) > new Date() && (
                <div className="flex justify-between text-xs py-1">
                  <span className="text-teal-600 dark:text-teal-500">Trial ends</span>
                  <span className="text-teal-900 dark:text-teal-200">{new Date(trialEndsAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              )}
              <div className="h-px bg-teal-200 dark:bg-teal-800 my-3" />
            </>
          )}

          {/* Usage bars */}
          <UsageBar label="Total sessions" current={totalSessions} max={limits.totalSessions} />
          <UsageBar label="Members" current={memberCount} max={limits.members} />
          <UsageBar label="Concurrent games" current={runningSessions} max={limits.concurrentSessions} />

          {/* Plan comparison (free only) */}
          {!isPro && (
            <>
              <div className="h-px bg-teal-200 dark:bg-teal-800 my-3" />
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-1 text-teal-600 dark:text-teal-500 font-semibold"></th>
                    <th className="text-center py-1 text-teal-600 dark:text-teal-500 font-semibold">Free</th>
                    <th className="text-center py-1 text-teal-800 dark:text-teal-300 font-semibold">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1.5 text-teal-700 dark:text-teal-400">Total sessions</td>
                    <td className="text-center text-teal-600 dark:text-teal-500">{LIMITS.free.totalSessions}</td>
                    <td className="text-center text-teal-900 dark:text-teal-200 font-medium">{LIMITS.pro.totalSessions}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-teal-700 dark:text-teal-400">Members</td>
                    <td className="text-center text-teal-600 dark:text-teal-500">{LIMITS.free.members}</td>
                    <td className="text-center text-teal-900 dark:text-teal-200 font-medium">{LIMITS.pro.members}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-teal-700 dark:text-teal-400">Clubs managed</td>
                    <td className="text-center text-teal-600 dark:text-teal-500">{LIMITS.free.clubs}</td>
                    <td className="text-center text-teal-900 dark:text-teal-200 font-medium">{LIMITS.pro.clubs}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-teal-700 dark:text-teal-400">Concurrent games</td>
                    <td className="text-center text-teal-600 dark:text-teal-500">{LIMITS.free.concurrentSessions}</td>
                    <td className="text-center text-teal-900 dark:text-teal-200 font-medium">{LIMITS.pro.concurrentSessions}</td>
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
              className="w-full mt-3 py-2 rounded-lg text-xs border border-teal-300 text-teal-700 hover:bg-teal-100 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-900 transition disabled:opacity-50"
            >
              {loading ? "..." : "Manage Billing →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
