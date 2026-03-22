"use client";

import { useState, useEffect, useCallback } from "react";
import { PlayerName } from "@/components/player-name";

interface SessionData {
  session: {
    id: string;
    name: string;
    status: string;
    clubName: string;
    numberOfCourts: number;
    playTimeMinutes: number;
    currentRoundStartedAt: string | null;
    currentPhase: string | null;
    startedAt: string | null;
    endedAt: string | null;
  };
  courts: { id: string; name: string; locked: boolean }[];
  assignments: {
    id: string;
    courtId: string;
    round: number;
    status: string;
    player: { id: string; name: string; gender: string | null } | null;
  }[];
  players: {
    id: string;
    name: string;
    gender: string | null;
    status: string;
    playCount: number;
  }[];
}

function PinEntry({ sessionId, onSuccess }: { sessionId: string; onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/sessions/${sessionId}/spectator`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (res.ok) {
      onSuccess();
    } else {
      const data = await res.json();
      setError(data.error || "Incorrect PIN");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-teal-600">🏸 shuttlrs</h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">Enter PIN to watch this session</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter PIN"
            autoFocus
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-center text-2xl font-mono tracking-[0.3em] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {error && <p className="text-center text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full rounded-xl bg-teal-600 py-3 text-lg font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? "Checking..." : "Watch"}
          </button>
        </form>
      </div>
    </div>
  );
}

function RoundTimer({ startedAt, playTimeMinutes }: { startedAt: string; playTimeMinutes: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const totalSeconds = playTimeMinutes * 60;
  const remaining = Math.max(0, totalSeconds - elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isOvertime = elapsed > totalSeconds;

  if (isOvertime) {
    const overSecs = elapsed - totalSeconds;
    const overMins = Math.floor(overSecs / 60);
    const overS = overSecs % 60;
    return (
      <span className="text-red-500 font-mono font-bold">
        +{overMins}:{String(overS).padStart(2, "0")}
      </span>
    );
  }

  return (
    <span className={`font-mono font-bold ${remaining < 60 ? "text-amber-500" : "text-teal-600"}`}>
      {mins}:{String(secs).padStart(2, "0")}
    </span>
  );
}

function SessionView({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionData | null>(null);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}/spectator/data`);
    if (!res.ok) {
      setError("Failed to load session");
      return;
    }
    setData(await res.json());
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000); // refresh every 2s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  const { session, courts, assignments, players } = data;

  if (session.status === "ended") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Session Ended</h1>
          <p className="mt-2 text-zinc-500">{session.name} — {session.clubName}</p>
        </div>
      </div>
    );
  }

  // Group assignments by court
  const activeAssignments = assignments.filter((a) => a.status === "active");
  const maxRound = activeAssignments.length > 0
    ? Math.max(...activeAssignments.map((a) => a.round))
    : 0;
  const currentAssignments = activeAssignments.filter((a) => a.round === maxRound);

  const upcomingAssignments = assignments.filter((a) => a.status === "upcoming");
  const upcomingRound = upcomingAssignments.length > 0
    ? Math.max(...upcomingAssignments.map((a) => a.round))
    : 0;
  const nextAssignments = upcomingAssignments.filter((a) => a.round === upcomingRound);

  const waitingPlayers = players.filter((p) => p.status === "available");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{session.name}</h1>
              <p className="text-sm text-zinc-500">{session.clubName}</p>
            </div>
            {session.currentRoundStartedAt && session.currentPhase === "playing" && (
              <RoundTimer
                startedAt={session.currentRoundStartedAt}
                playTimeMinutes={session.playTimeMinutes}
              />
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 mt-4 space-y-4">
        {/* Upcoming Games */}
        {nextAssignments.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mt-2">
              Up Next
            </h2>
            {courts.filter((c) => !c.locked).map((court) => {
              const courtPlayers = nextAssignments.filter((a) => a.courtId === court.id);
              if (courtPlayers.length === 0) return null;
              const team1 = courtPlayers.slice(0, 2);
              const team2 = courtPlayers.slice(2, 4);

              return (
                <div
                  key={`next-${court.id}`}
                  className="rounded-xl border border-dashed border-teal-300 bg-teal-50/50 p-4 dark:border-teal-800 dark:bg-teal-950/30"
                >
                  <h3 className="mb-3 text-sm font-semibold text-teal-600 dark:text-teal-400">
                    {court.name}
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      {team1.map((a) => (
                        <div key={a.id} className="flex items-center gap-2">
                          <PlayerName
                            name={a.player?.name || "—"}
                            gender={a.player?.gender}
                            className="text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-teal-300 dark:text-teal-700">VS</span>
                    <div className="flex-1 space-y-1 text-right">
                      {team2.map((a) => (
                        <div key={a.id} className="flex items-center justify-end gap-2">
                          <PlayerName
                            name={a.player?.name || "—"}
                            gender={a.player?.gender}
                            className="text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Current Games */}
        {currentAssignments.length > 0 && (
          <>
            {nextAssignments.length > 0 && (
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mt-2">
                Now Playing
              </h2>
            )}
            {courts.filter((c) => !c.locked).map((court) => {
              const courtPlayers = currentAssignments.filter((a) => a.courtId === court.id);
              if (courtPlayers.length === 0) return null;
              const team1 = courtPlayers.slice(0, 2);
              const team2 = courtPlayers.slice(2, 4);

              return (
                <div
                  key={court.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <h3 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                    {court.name}
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      {team1.map((a) => (
                        <div key={a.id} className="flex items-center gap-2">
                          <PlayerName
                            name={a.player?.name || "—"}
                            gender={a.player?.gender}
                            className="text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-zinc-300 dark:text-zinc-600">VS</span>
                    <div className="flex-1 space-y-1 text-right">
                      {team2.map((a) => (
                        <div key={a.id} className="flex items-center justify-end gap-2">
                          <PlayerName
                            name={a.player?.name || "—"}
                            gender={a.player?.gender}
                            className="text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Waiting Players */}
        {waitingPlayers.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              Waiting ({waitingPlayers.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {waitingPlayers.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800"
                >
                  <PlayerName
                    name={p.name}
                    gender={p.gender}
                    className="text-zinc-700 dark:text-zinc-300"
                  />
                  <span className="text-xs text-zinc-400">({p.playCount})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SpectatorView({ sessionId }: { sessionId: string }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if already authenticated (cookie exists)
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/spectator/data`)
      .then((res) => {
        if (res.ok) setAuthenticated(true);
      })
      .finally(() => setChecking(false));
  }, [sessionId]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!authenticated) {
    return <PinEntry sessionId={sessionId} onSuccess={() => setAuthenticated(true)} />;
  }

  return <SessionView sessionId={sessionId} />;
}
