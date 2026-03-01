"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddPlayerModal } from "./add-player-modal";
import { PlayerName } from "./player-name";
import { useSwap } from "./swap-context";

interface Player {
  id: string;
  status: string;
  play_count: number;
  last_played_at: string | null;
  user: {
    id: string;
    full_name: string;
    gender: string | null;
    level: number | null;
  } | null;
}

function statusColor(status: string) {
  switch (status) {
    case "playing":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "selected":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "resting":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "removed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

export function PlayerPool({
  players,
  isManager,
  isReadOnly,
  sessionId,
  currentUserId,
  clubMembers,
}: {
  players: Player[];
  isManager: boolean;
  isReadOnly?: boolean;
  sessionId?: string;
  currentUserId?: string;
  clubMembers?: { user_id: string | null; user: { id: string; full_name: string } | null }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const { selected: swapSelected, select: swapSelect, loading: swapLoading } = useSwap();

  const isInSession = players.some(
    (p) => p.user?.id === currentUserId && p.status !== "removed"
  );
  const currentPlayerStatus = players.find(
    (p) => p.user?.id === currentUserId
  )?.status;
  const isPending = currentPlayerStatus === "pending";

  async function handleAdmitReject(playerId: string, action: "admit" | "reject") {
    if (!sessionId) return;
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/players`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, action }),
    });
    setLoading(false);
    router.refresh();
  }

  async function addAllMembers() {
    if (!sessionId || !clubMembers) return;
    setLoading(true);
    const existingIds = new Set(players.map((p) => p.user?.id));
    const newIds = clubMembers
      .filter((m) => m.user_id && !existingIds.has(m.user_id))
      .map((m) => m.user_id!);

    if (newIds.length > 0) {
      await fetch(`/api/sessions/${sessionId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: newIds }),
      });
    }
    setLoading(false);
    router.refresh();
  }

  async function joinSession() {
    if (!sessionId || !currentUserId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: [currentUserId] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to join session");
      }
    } catch {
      setError("Network error — try again");
    }
    setLoading(false);
    router.refresh();
  }

  async function leaveSession() {
    if (!sessionId || !currentUserId) return;
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/players`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: currentUserId }),
    });
    setLoading(false);
    router.refresh();
  }

  async function removePlayer(playerId: string, playerName: string) {
    if (!sessionId || !confirm(`Remove ${playerName} from this session?`)) return;
    await fetch(`/api/sessions/${sessionId}/players`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    router.refresh();
  }

  const activePlayers = players.filter((p) => p.status !== "removed");
  const order = ["pending", "playing", "selected", "available", "resting", "removed"];
  const sorted = [...activePlayers].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status)
  );

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {isManager && sessionId && !isReadOnly && (
          <>
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add Players
            </button>
            <button
              onClick={addAllMembers}
              disabled={loading}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {loading ? "Adding..." : "Add All"}
            </button>
          </>
        )}

        {!isManager && sessionId && !isReadOnly && !isInSession && (
          <button
            onClick={joinSession}
            disabled={loading}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Requesting..." : "Request to Join"}
          </button>
        )}

        {!isManager && sessionId && !isReadOnly && isPending && (
          <span className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-1.5 text-sm font-medium text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400">
            ⏳ Request Pending
          </span>
        )}

        {!isManager && sessionId && !isReadOnly && isInSession && !isPending && (
          <button
            onClick={leaveSession}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading
              ? "Leaving..."
              : currentPlayerStatus === "playing"
                ? "Leave (after current game)"
                : "Leave Session"}
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-500">{error}</p>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">
            No players in this session yet.
            {isManager && " Click 'Add All Club Members' to populate."}
            {!isManager && " Click 'Join Session' to add yourself."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Player
                </th>
                <th className="px-4 py-2.5 text-center font-medium text-zinc-500 dark:text-zinc-400">
                  Games
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
                {isManager && (
                  <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((player) => {
                const canSwap = isManager && !isReadOnly && swapSelected &&
                  swapSelected.source === "court" &&
                  swapSelected.id !== player.user?.id &&
                  ["available", "resting"].includes(player.status);
                const isSwapHighlight = canSwap;

                return (
                <tr
                  key={player.id}
                  onClick={() => {
                    if (canSwap && player.user && !swapLoading) {
                      swapSelect({ id: player.user.id, source: "pool" });
                    }
                  }}
                  className={`border-b border-zinc-50 last:border-0 dark:border-zinc-800/50 ${
                    isSwapHighlight
                      ? "bg-teal-50 hover:bg-teal-100 cursor-pointer dark:bg-teal-950/20 dark:hover:bg-teal-900/30"
                      : player.user?.id === currentUserId
                      ? "bg-blue-50/50 dark:bg-blue-950/20"
                      : ""
                  }`}
                >
                  <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100">
                    <div className="flex items-center gap-2">
                      {isSwapHighlight && <span className="text-xs opacity-40">↔</span>}
                      <PlayerName
                        name={player.user?.full_name || "Unknown"}
                        gender={player.user?.gender}
                      />
                    </div>
                    {player.user?.id === currentUserId && (
                      <span className="ml-1.5 text-xs text-blue-500">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center text-zinc-600 dark:text-zinc-400">
                    {player.play_count}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor(player.status)}`}
                    >
                      {player.status}
                    </span>
                  </td>
                  {isManager && (
                    <td className="px-4 py-2.5 text-right">
                      {player.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => player.user && handleAdmitReject(player.user.id, "admit")}
                            disabled={loading}
                            className="text-xs font-medium text-green-600 hover:text-green-800 disabled:opacity-50"
                          >
                            Admit
                          </button>
                          <button
                            onClick={() => player.user && handleAdmitReject(player.user.id, "reject")}
                            disabled={loading}
                            className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => player.user && removePlayer(player.user.id, player.user.full_name || "this player")}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && sessionId && clubMembers && (
        <AddPlayerModal
          sessionId={sessionId}
          clubMembers={clubMembers}
          existingPlayers={players}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
