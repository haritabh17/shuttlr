"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface DeletedSession {
  id: string;
  name: string | null;
  deleted_at: string | null;
  status: string;
  play_time_minutes: number;
  number_of_courts: number;
}

export function DeletedSessions({
  sessions,
  clubSlug,
}: {
  sessions: DeletedSession[];
  clubSlug: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (sessions.length === 0) return null;

  return (
    <section>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <span className="text-xs">{expanded ? "▼" : "▶"}</span>
        Deleted Sessions ({sessions.length})
      </button>
      {expanded && (
        <div className="space-y-2">
          {sessions.map((s) => (
            <DeletedSessionRow key={s.id} session={s} clubSlug={clubSlug} />
          ))}
        </div>
      )}
    </section>
  );
}

function DeletedSessionRow({
  session,
  clubSlug,
}: {
  session: DeletedSession;
  clubSlug: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);

  async function handleRestore() {
    setRestoring(true);
    await supabase
      .from("sessions")
      .update({ deleted_at: null })
      .eq("id", session.id);
    setRestoring(false);
    router.refresh();
  }

  const deletedDate = session.deleted_at
    ? new Date(session.deleted_at).toLocaleDateString()
    : "";

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
          {session.name || `Session`}
        </p>
        <p className="text-xs text-zinc-400">
          Deleted {deletedDate} · {session.play_time_minutes}min · {session.number_of_courts} courts
        </p>
      </div>
      <button
        onClick={handleRestore}
        disabled={restoring}
        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {restoring ? "..." : "Restore"}
      </button>
    </div>
  );
}
