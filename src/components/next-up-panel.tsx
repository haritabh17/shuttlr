"use client";

import { PlayerName } from "./player-name";

interface Court {
  name: string;
  game_type: string | null;
  players: {
    id: string;
    full_name: string;
    level: number | null;
    gender: string | null;
  }[];
}

interface NextUpPanelProps {
  courts: Court[];
  round: number;
  isManager?: boolean;
}

export function NextUpPanel({ courts, round, isManager }: NextUpPanelProps) {
  if (courts.length === 0) return null;

  return (
    <div className="mt-6 opacity-75">
      <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Next Round {round > 0 && `(Round ${round})`}
        <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
          Get ready!
        </span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {courts.map((court, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                {court.name}
              </h3>
              {court.game_type && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    court.game_type === "mixed"
                      ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}
                >
                  {court.game_type === "mixed" ? "Mixed" : "Doubles"}
                </span>
              )}
            </div>

            {court.players.length > 0 ? (
              <div className="space-y-1.5">
                {court.players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-1.5 text-sm dark:bg-zinc-800"
                  >
                    <PlayerName
                      name={p.full_name}
                      gender={p.gender}
                      className="text-zinc-900 dark:text-zinc-100"
                    />
                    {isManager && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        L{p.level || "?"}
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
        ))}
      </div>
    </div>
  );
}
