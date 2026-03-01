"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SelectionTimerProps {
  sessionId: string;
  sessionStatus: string;
  playTimeMinutes: number;
  restTimeMinutes: number;
  selectionIntervalMinutes: number;
  currentPhase: string;
  currentRoundStartedAt: string | null;
}

export function SelectionTimer({
  sessionStatus,
  playTimeMinutes,
  restTimeMinutes,
  selectionIntervalMinutes,
  currentPhase,
  currentRoundStartedAt,
}: SelectionTimerProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (sessionStatus !== "running" || !currentRoundStartedAt || currentPhase === "idle") {
      setTimeLeft(null);
      return;
    }

    const totalMs =
      currentPhase === "playing"
        ? playTimeMinutes * 60 * 1000
        : restTimeMinutes * 60 * 1000;

    const startTime = new Date(currentRoundStartedAt).getTime();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, totalMs - elapsed);
      setTimeLeft(remaining);
    };

    tick();
    const timer = setInterval(tick, 1000);

    // Auto-refresh page when timer hits zero to pick up new state
    const refreshTimer = setTimeout(() => {
      router.refresh();
    }, Math.max(0, totalMs - (Date.now() - startTime) + 500));

    return () => {
      clearInterval(timer);
      clearTimeout(refreshTimer);
    };
  }, [sessionStatus, playTimeMinutes, restTimeMinutes, currentPhase, currentRoundStartedAt, router]);

  // Periodically refresh to stay in sync with backend
  useEffect(() => {
    if (sessionStatus !== "running") return;
    const interval = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(interval);
  }, [sessionStatus, router]);

  if (sessionStatus !== "running" || timeLeft === null) return null;

  const isResting = currentPhase === "resting";
  const totalMs = isResting ? restTimeMinutes * 60 * 1000 : playTimeMinutes * 60 * 1000;
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const selectionRemainingMs = (playTimeMinutes - selectionIntervalMinutes) * 60 * 1000;
  const isUrgent = !isResting && timeLeft <= selectionRemainingMs;
  const progress = totalMs > 0 ? ((totalMs - timeLeft) / totalMs) * 100 : 100;

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        isResting
          ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
          : isUrgent
            ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {isResting ? "Rest Time" : "Game Time"}
        </p>
        {isResting && (
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            Next round starting soon
          </span>
        )}
        {!isResting && isUrgent && (
          <span className="text-xs font-medium text-red-600 dark:text-red-400 animate-pulse">
            Round ending soon
          </span>
        )}
      </div>

      <p
        className={`text-center text-3xl font-bold tabular-nums ${
          isResting
            ? "text-blue-600 dark:text-blue-400"
            : isUrgent
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-900 dark:text-zinc-50"
        }`}
      >
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </p>

      <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isResting ? "bg-blue-500" : isUrgent ? "bg-red-500" : "bg-green-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
