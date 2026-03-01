"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AlgorithmSettings } from "@/components/algorithm-settings";

interface Session {
  id: string;
  name: string;
  number_of_courts: number;
  play_time_minutes: number;
  rest_time_minutes: number;
  selection_interval_minutes: number;
  mixed_ratio: number;
  skill_balance: number;
  partner_variety: number;
}

export function EditSessionSettings({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(session.name);
  const [courts, setCourts] = useState(session.number_of_courts);
  const [playTime, setPlayTime] = useState(session.play_time_minutes);
  const [restTime, setRestTime] = useState(session.rest_time_minutes);
  const [selectionInterval, setSelectionInterval] = useState(session.selection_interval_minutes);
  const [mixedRatio, setMixedRatio] = useState(session.mixed_ratio ?? 50);
  const [skillBalance, setSkillBalance] = useState(session.skill_balance ?? 70);
  const [partnerVariety, setPartnerVariety] = useState(session.partner_variety ?? 80);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (courts < 1 || playTime < 1 || restTime < 0 || selectionInterval < 1) {
      setError("Please enter valid values (courts ≥ 1, play time ≥ 1, rest time ≥ 0, interval ≥ 1)");
      return;
    }

    setLoading(true);
    const { error: updateErr } = await supabase
      .from("sessions")
      .update({
        name: name.trim() || session.name,
        number_of_courts: courts,
        play_time_minutes: playTime,
        rest_time_minutes: restTime,
        selection_interval_minutes: selectionInterval,
        mixed_ratio: mixedRatio,
        skill_balance: skillBalance,
        partner_variety: partnerVariety,
      } as any)
      .eq("id", session.id);

    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        title="Edit session settings"
      >
        ⚙️ Settings
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Session Settings
        </h3>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Session name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Courts
              </label>
              <input
                type="number"
                value={courts}
                onChange={(e) => setCourts(Number(e.target.value))}
                min={1}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
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
          </div>

          <AlgorithmSettings
            mixedRatio={mixedRatio}
            skillBalance={skillBalance}
            partnerVariety={partnerVariety}
            onMixedRatioChange={setMixedRatio}
            onSkillBalanceChange={setSkillBalance}
            onPartnerVarietyChange={setPartnerVariety}
            numCourts={courts}
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
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
