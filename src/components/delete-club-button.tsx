"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteClubButtonProps {
  clubId: string;
  clubName: string;
  memberCount: number;
}

export function DeleteClubButton({ clubId, clubName, memberCount }: DeleteClubButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const canDelete = memberCount <= 1;
  const confirmed = confirmText === clubName;

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/clubs/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId }),
    });
    const data = await res.json();
    if (data.ok) {
      router.push("/?deleted=true");
    } else {
      setError(data.error || "Failed to delete club");
      setLoading(false);
    }
  }

  if (!canDelete) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Delete Club</h3>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Remove all other members before deleting this club.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
      <h3 className="text-sm font-semibold text-red-900 dark:text-red-100">Danger Zone</h3>

      {!confirming ? (
        <div className="mt-2">
          <p className="text-xs text-red-700 dark:text-red-300">
            Permanently delete this club and all its data.
          </p>
          <button
            onClick={() => setConfirming(true)}
            className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900"
          >
            Delete Club
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-xs text-red-700 dark:text-red-300">
            Type <span className="font-semibold">{clubName}</span> to confirm:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={clubName}
            className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-900 placeholder-red-300 focus:border-red-500 focus:outline-none dark:border-red-700 dark:bg-red-950 dark:text-red-100 dark:placeholder-red-700"
          />
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={!confirmed || loading}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
            >
              {loading ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              onClick={() => { setConfirming(false); setConfirmText(""); setError(null); }}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
