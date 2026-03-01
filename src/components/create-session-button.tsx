"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { AlgorithmSettings } from "@/components/algorithm-settings";

export function CreateSessionButton({ clubId, clubName }: { clubId: string; clubName?: string }) {
  const [open, setOpen] = useState(false);
  const defaultName = `${clubName || "Session"} — ${new Date().toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  const [name, setName] = useState(defaultName);
  const [playTime, setPlayTime] = useState(15);
  const [restTime, setRestTime] = useState(5);
  const [selectionInterval, setSelectionInterval] = useState(12);
  const [numberOfCourts, setNumberOfCourts] = useState(2);
  const [mixedRatio, setMixedRatio] = useState(50);
  const [skillBalance, setSkillBalance] = useState(70);
  const [partnerVariety, setPartnerVariety] = useState(80);
  const [strictGender, setStrictGender] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectionInterval >= playTime) {
      setError("Selection interval must be less than play time");
      return;
    }

    setLoading(true);

    // Check session limits
    const { data: sub } = await (supabase as any)
      .from("club_subscriptions")
      .select("plan, status, trial_ends_at")
      .eq("club_id", clubId)
      .single();

    const isTrialing = sub?.status === "trialing" && sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date();
    const isPro = sub?.plan === "pro" && sub?.status === "active";

    if (!isTrialing && !isPro) {
      // Free plan — check monthly limit
      const currentMonth = new Date().toISOString().slice(0, 7); // '2026-02'
      const { data: usage } = await (supabase as any)
        .from("session_usage")
        .select("session_count")
        .eq("club_id", clubId)
        .eq("month", currentMonth)
        .single();

      const FREE_LIMIT = 4;
      if ((usage?.session_count ?? 0) >= FREE_LIMIT) {
        setError(`Free plan limit reached (${FREE_LIMIT} sessions/month). Upgrade to Pro for unlimited sessions.`);
        setLoading(false);
        return;
      }
    }

    const { error: err } = await supabase.from("sessions").insert({
      club_id: clubId,
      name: name || "Session",
      play_time_minutes: playTime,
      rest_time_minutes: restTime,
      selection_interval_minutes: selectionInterval,
      number_of_courts: numberOfCourts,
      mixed_ratio: mixedRatio,
      skill_balance: skillBalance,
      partner_variety: partnerVariety,
      strict_gender: strictGender,
      status: "draft",
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setOpen(false);
    setName("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        New Session
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Create Session
        </h3>

        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Session name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="e.g. Thursday Evening"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Play time (min)
              </label>
              <input
                type="number"
                value={playTime}
                onChange={(e) => setPlayTime(Number(e.target.value))}
                min={1}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Rest time (min)
              </label>
              <input
                type="number"
                value={restTime}
                onChange={(e) => setRestTime(Number(e.target.value))}
                min={0}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Selection interval (min)
              </label>
              <input
                type="number"
                value={selectionInterval}
                onChange={(e) => setSelectionInterval(Number(e.target.value))}
                min={1}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Number of courts
              </label>
              <input
                type="number"
                value={numberOfCourts}
                onChange={(e) => setNumberOfCourts(Number(e.target.value))}
                min={1}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <AlgorithmSettings
            mixedRatio={mixedRatio}
            skillBalance={skillBalance}
            partnerVariety={partnerVariety}
            strictGender={strictGender}
            onMixedRatioChange={setMixedRatio}
            onSkillBalanceChange={setSkillBalance}
            onPartnerVarietyChange={setPartnerVariety}
            onStrictGenderChange={setStrictGender}
            numCourts={numberOfCourts}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
