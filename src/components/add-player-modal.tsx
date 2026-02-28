"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { PlayerName } from "./player-name";

interface ClubMember {
  user_id: string | null;
  user: { id: string; full_name: string; gender?: string | null } | null;
}

interface Player {
  user: { id: string } | null;
  status: string;
}

export function AddPlayerModal({
  sessionId,
  clubMembers,
  existingPlayers,
  onClose,
}: {
  sessionId: string;
  clubMembers: ClubMember[];
  existingPlayers: Player[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const existingIds = new Set(
    existingPlayers.filter((p) => p.status !== "removed").map((p) => p.user?.id)
  );

  const available = clubMembers.filter(
    (m) => m.user_id && m.user && !existingIds.has(m.user_id)
  );

  const filtered = search
    ? available.filter((m) =>
        m.user!.full_name.toLowerCase().includes(search.toLowerCase())
      )
    : available;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((m) => m.user_id!)));
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds: [...selected] }),
    });
    setLoading(false);
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Add Players</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        <div className="p-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            autoFocus
          />

          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-zinc-500">{available.length} available</span>
            <button
              onClick={selectAll}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Select all{filtered.length !== available.length ? ` (${filtered.length})` : ""}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                {available.length === 0 ? "All members already added" : "No matches"}
              </p>
            ) : (
              filtered.map((m) => (
                <label
                  key={m.user_id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(m.user_id!)}
                    onChange={() => toggle(m.user_id!)}
                    className="rounded border-zinc-300"
                  />
                  <PlayerName
                    name={m.user!.full_name}
                    gender={m.user!.gender}
                    className="text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={addSelected}
            disabled={selected.size === 0 || loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Adding..." : `Add ${selected.size || ""} Player${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
