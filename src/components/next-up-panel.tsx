"use client";

import { PlayerName } from "./player-name";
import { useSwap } from "./swap-context";

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
  isReadOnly?: boolean;
}

export function NextUpPanel({ courts, round, isManager, isReadOnly }: NextUpPanelProps) {
  const { selected, select, loading: swapLoading } = useSwap();

  if (courts.length === 0) return null;

  return (
    <div>
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
                {court.players.map((p) => {
                  const isSelected = selected?.id === p.id;
                  const isSwapTarget = selected && selected.id !== p.id;

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (isManager && !isReadOnly && !swapLoading) {
                          select({ id: p.id, source: "court" });
                        }
                      }}
                      className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        isManager && !isReadOnly ? "cursor-pointer" : ""
                      } ${
                        isSelected
                          ? "bg-teal-100 ring-2 ring-teal-500 dark:bg-teal-900/40 dark:ring-teal-400"
                          : isSwapTarget && isManager
                          ? "bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/20 dark:hover:bg-teal-900/30"
                          : "bg-zinc-50 dark:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected && <span className="text-xs">🔄</span>}
                        {isSwapTarget && isManager && <span className="text-xs opacity-40">↔</span>}
                        <PlayerName
                          name={p.full_name}
                          gender={p.gender}
                          className="text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      {isManager && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          L{p.level || "?"}
                        </span>
                      )}
                    </div>
                  );
                })}
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
