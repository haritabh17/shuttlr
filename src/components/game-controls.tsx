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
  runningCount?: number;
  concurrentLimit?: number;
}

export function GameControls({
  session,
  isManager,
  isReadOnly,
  canResurrect,
  clubSlug,
  runningCount = 0,
  concurrentLimit = 1,
}: GameControlsProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(newStatus: string) {
    setError(null);
    // Check concurrent limit when starting a session
    if (newStatus === "running" && session.status !== "running") {
      // Count currently running sessions (excluding this one which is about to start)
      const currentRunning = session.status === "running" ? runningCount : runningCount;
      if (currentRunning >= concurrentLimit) {
        setError(`Concurrent session limit reached (${concurrentLimit}). End another session first${concurrentLimit === 1 ? " or upgrade to Pro" : ""}.`);
        return;
      }
    }

    setLoading(newStatus);
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "running" && session.status === "initiated") {
      updates.started_at = new Date().toISOString();
      updates.current_phase = "idle"; // worker will pick this up and run first selection
    }
    if (newStatus === "running" && (session.status === "paused" || session.status === "ended")) {
      // Resume: restore timer from where it was paused
      const pausedElapsed = (session as any).paused_elapsed_ms;
      if (pausedElapsed && session.status === "paused") {
        // Set current_round_started_at back in time so timer picks up where it left off
        const resumedStart = new Date(Date.now() - pausedElapsed).toISOString();
        updates.current_round_started_at = resumedStart;
        updates.current_phase = (session as any).paused_phase || "playing";
        (updates as any).paused_phase = null;
      } else {
        updates.started_at = new Date().toISOString();
        updates.current_round_started_at = new Date().toISOString();
      }
      updates.ended_at = null;
      (updates as any).paused_elapsed_ms = null;
    }
    if (newStatus === "paused") {
      // Save current phase and elapsed time before pausing
      const currentPhase = (session as any).current_phase || "playing";
      (updates as any).paused_phase = currentPhase;
      updates.current_phase = "idle"; // stops the edge function from processing
      const roundStarted = (session as any).current_round_started_at;
      if (roundStarted) {
        const elapsed = Date.now() - new Date(roundStarted).getTime();
        (updates as any).paused_elapsed_ms = Math.max(0, elapsed);
      }
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
    <div>
      {error && (
        <p className="mb-2 text-sm text-red-500">{error}</p>
      )}
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

      {session.status === "running" && (
        <button
          onClick={async () => {
            if (!confirm("Discard current selection and pick new players?")) return;
            setLoading("discard");
            // Delete current active assignments
            await supabase
              .from("court_assignments")
              .delete()
              .eq("session_id", session.id)
              .eq("assignment_status", "active");
            // Reset all playing players to available
            await supabase
              .from("session_players")
              .update({ status: "available" })
              .eq("session_id", session.id)
              .eq("status", "playing");
            // Reset phase to idle — Edge Function will run fresh selection
            await supabase
              .from("sessions")
              .update({ current_phase: "idle", current_round_started_at: null, selecting: false } as any)
              .eq("id", session.id);
            setLoading(null);
            router.refresh();
          }}
          disabled={disabled || loading !== null}
          className={`${btnBase} border border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950`}
        >
          {loading === "discard" ? "..." : "Reshuffle"}
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

      {isManager && session.status === "draft" && (
        <button
          onClick={handleDelete}
          disabled={loading !== null}
          className={`${btnBase} ml-auto border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950`}
        >
          Delete
        </button>
      )}
    </div>
    </div>
  );
}
