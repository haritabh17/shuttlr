"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface RealtimeNotificationProps {
  sessionId: string;
  userId: string;
  courts: { id: string; name: string }[];
}

interface Notification {
  id: string;
  message: string;
  timestamp: number;
}

export function RealtimeNotification({
  sessionId,
  userId,
  courts,
}: RealtimeNotificationProps) {
  const supabase = createClient();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "court_assignments",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const assignment = payload.new as {
            user_id: string;
            court_id: string;
            round: number;
            assignment_status?: string;
          };

          const isUpcoming = assignment.assignment_status === "upcoming";

          // Only notify if this assignment is for the current user
          if (assignment.user_id === userId) {
            const court = courts.find((c) => c.id === assignment.court_id);
            const courtName = court?.name ?? "a court";
            const notification: Notification = {
              id: `${assignment.court_id}-${assignment.round}-${isUpcoming ? "next" : "now"}`,
              message: isUpcoming
                ? `You're up next! Get ready for ${courtName} (Round ${assignment.round})`
                : `You're up! Head to ${courtName} (Round ${assignment.round})`,
              timestamp: Date.now(),
            };
            setNotifications((prev) => [notification, ...prev]);

            // Auto-dismiss after 10 seconds
            setTimeout(() => {
              setNotifications((prev) =>
                prev.filter((n) => n.id !== notification.id)
              );
            }, 10000);
          }

          // Refresh page data on any new assignment
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "court_assignments",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // Refresh when assignments change (e.g. upcoming → active)
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => {
          // Refresh on session status changes
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, userId, courts, supabase, router]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="animate-in slide-in-from-right rounded-lg border border-green-300 bg-green-50 px-4 py-3 shadow-lg dark:border-green-800 dark:bg-green-950"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🏸</span>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              {n.message}
            </p>
          </div>
          <button
            onClick={() =>
              setNotifications((prev) => prev.filter((x) => x.id !== n.id))
            }
            className="absolute right-2 top-2 text-green-400 hover:text-green-600"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
