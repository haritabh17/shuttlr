"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface GameControlsProps {
  session: {
    id: string;
    status: string;
    club_id: string;
  };
  isManager: boolean;
  isReadOnly: boolean;
  canResurrect?: boolean;
  clubId: string;
  clubSlug: string;
}

export function GameControls({
  session,
  isManager,
  isReadOnly,
  canResurrect,
  clubSlug,
}: GameControlsProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(newStatus: string) {
    setLoading(newStatus);
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "running" && session.status === "initiated") {
      updates.started_at = new Date().toISOString();
      updates.current_phase = "idle"; // worker will pick this up and run first selection
    }
    if (newStatus === "running" && (session.status === "paused" || session.status === "ended")) {
      // Resume: reset round timer from now, clear ended_at
      updates.current_round_started_at = new Date().toISOString();
      updates.ended_at = null;
    }
    if (newStatus === "paused") {
      updates.current_phase = "idle"; // pause stops the worker from processing
    }
    if (newStatus === "ended") {
      updates.ended_at = new Date().toISOString();
      updates.current_phase = "idle";
    }

    await supabase
      .from("sessions")
      .update(updates as any)
      .eq("id", session.id);

    setLoading(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Soft-delete this session? It can be restored within 1 month.")) return;
    setLoading("delete");
    await supabase
      .from("sessions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", session.id);
    setLoading(null);
    router.push(`/clubs/${clubSlug}`);
    router.refresh();
  }

  const disabled = !isManager;
  const btnBase =
    "rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";

  if (isReadOnly && !canResurrect) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        This session has ended. Read-only view.
      </div>
    );
  }

  if (canResurrect && session.status === "ended") {
    return (
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Session ended — can be resumed within 24h
        </div>
        {isManager && (
          <button
            onClick={() => updateStatus("running")}
            disabled={loading !== null}
            className={`${btnBase} bg-green-600 text-white hover:bg-green-700`}
          >
            {loading === "running" ? "..." : "Resume Session"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {session.status === "draft" && (
        <button
          onClick={() => updateStatus("initiated")}
          disabled={disabled || loading !== null}
          className={`${btnBase} bg-yellow-500 text-white hover:bg-yellow-600`}
        >
          {loading === "initiated" ? "..." : "Initiate"}
        </button>
      )}

      {session.status === "initiated" && (
        <button
          onClick={() => updateStatus("running")}
          disabled={disabled || loading !== null}
          className={`${btnBase} bg-green-600 text-white hover:bg-green-700`}
        >
          {loading === "running" ? "..." : "Start"}
        </button>
      )}

      {session.status === "running" && (
        <button
          onClick={() => { if (confirm("Pause this session?")) updateStatus("paused"); }}
          disabled={disabled || loading !== null}
          className={`${btnBase} bg-orange-500 text-white hover:bg-orange-600`}
        >
          {loading === "paused" ? "..." : "Pause"}
        </button>
      )}

      {session.status === "paused" && (
        <button
          onClick={() => updateStatus("running")}
          disabled={disabled || loading !== null}
          className={`${btnBase} bg-green-600 text-white hover:bg-green-700`}
        >
          {loading === "running" ? "..." : "Resume"}
        </button>
      )}

      {session.status === "running" && (
        <button
          onClick={async () => {
            if (!confirm("End the current round and select new players?")) return;
            setLoading("endround");
            // Reset phase to idle — the Edge Function will pick this up and run selection
            await supabase
              .from("sessions")
              .update({ current_phase: "idle", current_round_started_at: null } as any)
              .eq("id", session.id);
            setLoading(null);
            router.refresh();
          }}
          disabled={disabled || loading !== null}
          className={`${btnBase} border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950`}
        >
          {loading === "endround" ? "..." : "End Round"}
        </button>
      )}

      {["initiated", "running", "paused"].includes(session.status) && (
        <button
          onClick={() => { if (confirm("End this session?")) updateStatus("ended"); }}
          disabled={disabled || loading !== null}
          className={`${btnBase} bg-red-600 text-white hover:bg-red-700`}
        >
          {loading === "ended" ? "..." : "End Session"}
        </button>
      )}

      {isManager && (
        <button
          onClick={handleDelete}
          disabled={loading !== null}
          className={`${btnBase} ml-auto border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950`}
        >
          Delete
        </button>
      )}
    </div>
  );
}
