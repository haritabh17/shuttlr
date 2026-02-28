import Link from "next/link";

interface Session {
  id: string;
  name: string;
  status: string;
  play_time_minutes: number;
  rest_time_minutes: number;
  number_of_courts: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    initiated: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    running: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    paused: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    ended: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  };
  return styles[status] || styles.draft;
}

export function SessionList({
  sessions,
  clubSlug,
}: {
  sessions: Session[];
  clubSlug: string;
}) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-zinc-500 dark:text-zinc-400">No sessions yet.</p>
      </div>
    );
  }

  const live = sessions.filter((s) => ["initiated", "running", "paused"].includes(s.status));
  const past = sessions.filter((s) => s.status === "ended");
  const draft = sessions.filter((s) => s.status === "draft");

  const groups = [
    { label: "Live", items: live },
    { label: "Drafts", items: draft },
    { label: "Past", items: past },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.items.map((session) => (
              <Link
                key={session.id}
                href={`/clubs/${clubSlug}/sessions/${session.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {session.name}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {session.number_of_courts} courts · {session.play_time_minutes}min play · {session.rest_time_minutes}min rest
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge(session.status)}`}
                >
                  {session.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
