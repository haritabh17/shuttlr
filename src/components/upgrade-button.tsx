"use client";

import { useState } from "react";

interface UpgradeButtonProps {
  clubId: string;
  subscription: {
    plan: string;
    status: string;
    trial_ends_at: string | null;
  } | null;
  sessionCount: number;
}

export function UpgradeButton({ clubId, subscription, sessionCount }: UpgradeButtonProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const isTrialing = subscription?.status === "trialing" &&
    subscription?.trial_ends_at &&
    new Date(subscription.trial_ends_at) > new Date();
  const isPro = subscription?.plan === "pro" && subscription?.status === "active";

  if (isPro) return null; // Already pro, no need to show

  const FREE_LIMIT = 4;
  const trialEndsDate = subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })
    : null;

  async function handleUpgrade(billingCycle: "monthly" | "yearly") {
    setLoading(billingCycle);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, billingCycle }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || "Failed to start checkout");
      setLoading(null);
    }
  }

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 dark:border-teal-900 dark:bg-teal-950">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-teal-900 dark:text-teal-100">
            {isTrialing ? "Free Trial" : "Free Plan"}
          </h3>
          <p className="mt-0.5 text-xs text-teal-700 dark:text-teal-300">
            {isTrialing
              ? `Unlimited sessions until ${trialEndsDate}. After that, ${FREE_LIMIT} sessions/month.`
              : `${sessionCount}/${FREE_LIMIT} sessions used this month.`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => handleUpgrade("monthly")}
          disabled={loading !== null}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-40"
        >
          {loading === "monthly" ? "Redirecting..." : "Upgrade — €2.99/mo"}
        </button>
        <button
          onClick={() => handleUpgrade("yearly")}
          disabled={loading !== null}
          className="rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100 disabled:opacity-40 dark:text-teal-300 dark:hover:bg-teal-900"
        >
          {loading === "yearly" ? "Redirecting..." : "Upgrade — €24.99/yr (save 30%)"}
        </button>
      </div>
    </div>
  );
}
