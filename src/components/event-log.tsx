"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Event {
  id: string;
  actor_type: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  actor: {
    full_name: string;
  } | null;
}

export function EventLog({ clubId }: { clubId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("events")
        .select("id, actor_type, event_type, payload, created_at, actor:profiles!actor_id(full_name)")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(200);
      setEvents((data as unknown as Event[]) ?? []);
      setLoading(false);
    }
    load();
  }, [clubId, supabase]);

  // Get unique event types for filter dropdown
  const eventTypes = [...new Set(events.map((e) => e.event_type))].sort();

  const filtered = events.filter((e) => {
    if (typeFilter !== "all" && e.event_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.event_type.includes(q) ||
        (e.actor?.full_name ?? "").toLowerCase().includes(q) ||
        JSON.stringify(e.payload).toLowerCase().includes(q)
      );
    }
    return true;
  });

  function formatTime(ts: string) {
    return new Date(ts).toLocaleString();
  }

  function eventIcon(type: string) {
    if (type.includes("selection")) return "🎯";
    if (type.includes("session")) return "📋";
    if (type.includes("member")) return "👤";
    if (type.includes("court")) return "🏸";
    if (type.includes("player")) return "🏃";
    if (type.includes("promote")) return "⬆️";
    if (type.includes("delete")) return "🗑️";
    return "📝";
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events..."
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="all">All types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No events found.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </p>
          {filtered.map((event) => (
            <div
              key={event.id}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{eventIcon(event.event_type)}</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {event.event_type.replace(/_/g, " ")}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {event.actor_type}
                  </span>
                </div>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {formatTime(event.created_at)}
                </span>
              </div>
              {event.actor && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  by {event.actor.full_name}
                </p>
              )}
              {Object.keys(event.payload).length > 0 && (
                <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
