"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlayerName } from "./player-name";

interface Court {
  id: string;
  name: string;
  locked: boolean;
}

interface Assignment {
  id: string;
  court_id: string;
  round: number;
  user: {
    id: string;
    full_name: string;
    gender: string | null;
    level: number | null;
  } | null;
}

export function CourtView({
  courts,
  assignments,
  isManager,
  isReadOnly,
}: {
  courts: Court[];
  assignments: Assignment[];
  isManager: boolean;
  isReadOnly: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function toggleLock(courtId: string) {
    setLoading(courtId);
    await fetch(`/api/courts/${courtId}/toggle-lock`, { method: "POST" });
    setLoading(null);
    router.refresh();
  }

  if (courts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-zinc-500 dark:text-zinc-400">
          No courts set up yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {courts.map((court) => {
        const courtPlayers = assignments.filter((a) => a.court_id === court.id);
        return (
          <div
            key={court.id}
            className={`rounded-xl border p-4 ${
              court.locked
                ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                {court.name}
              </h3>
              <div className="flex items-center gap-2">
                {court.locked && (
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    🔒 Locked
                  </span>
                )}
                {isManager && !isReadOnly && (
                  <button
                    onClick={() => toggleLock(court.id)}
                    disabled={loading === court.id}
                    className="rounded px-2 py-0.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    {loading === court.id
                      ? "..."
                      : court.locked
                      ? "Unlock"
                      : "Lock"}
                  </button>
                )}
              </div>
            </div>

            {courtPlayers.length > 0 ? (
              <div className="space-y-1.5">
                {courtPlayers.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-1.5 text-sm dark:bg-zinc-800"
                  >
                    <PlayerName
                      name={a.user?.full_name || "Unknown"}
                      gender={a.user?.gender}
                      className="text-zinc-900 dark:text-zinc-100"
                    />
                    {isManager && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        L{a.user?.level || "?"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">
                Empty
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
