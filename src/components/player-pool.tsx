"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddPlayerModal } from "./add-player-modal";
import { PlayerName } from "./player-name";

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
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

export function PlayerPool({
  players,
  isManager,
  sessionId,
  currentUserId,
  clubMembers,
}: {
  players: Player[];
  isManager: boolean;
  sessionId?: string;
  currentUserId?: string;
  clubMembers?: { user_id: string | null; user: { id: string; full_name: string } | null }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const isInSession = players.some(
    (p) => p.user?.id === currentUserId && p.status !== "removed"
  );
  const currentPlayerStatus = players.find(
    (p) => p.user?.id === currentUserId
  )?.status;

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
    await fetch(`/api/sessions/${sessionId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds: [currentUserId] }),
    });
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
  const order = ["playing", "selected", "available", "resting", "removed"];
  const sorted = [...activePlayers].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status)
  );

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {isManager && sessionId && (
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

        {!isManager && sessionId && !isInSession && (
          <button
            onClick={joinSession}
            disabled={loading}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join Session"}
          </button>
        )}

        {!isManager && sessionId && isInSession && (
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
              {sorted.map((player) => (
                <tr
                  key={player.id}
                  className={`border-b border-zinc-50 last:border-0 dark:border-zinc-800/50 ${
                    player.user?.id === currentUserId
                      ? "bg-blue-50/50 dark:bg-blue-950/20"
                      : ""
                  }`}
                >
                  <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100">
                    <PlayerName
                      name={player.user?.full_name || "Unknown"}
                      gender={player.user?.gender}
                    />
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
                      <button
                        onClick={() => player.user && removePlayer(player.user.id, player.user.full_name || "this player")}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
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
