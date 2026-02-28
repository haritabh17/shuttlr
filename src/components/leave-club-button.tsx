"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface LeaveClubButtonProps {
  clubId: string;
  clubName: string;
  membershipId: string;
  isManager?: boolean;
}

export function LeaveClubButton({ clubId, clubName, membershipId, isManager }: LeaveClubButtonProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLeave() {
    if (isManager) {
      // Check if there's another manager
      const { data: managers } = await supabase
        .from("club_members")
        .select("id")
        .eq("club_id", clubId)
        .eq("role", "manager")
        .eq("status", "active");

      if ((managers?.length ?? 0) <= 1) {
        alert("You're the only manager. Promote another member to manager before leaving.");
        return;
      }

      if (!confirm(`Are you sure you want to leave ${clubName}?\n\n⚠️ You are a manager. The club will continue without you.`)) return;
    } else {
      if (!confirm(`Are you sure you want to leave ${clubName}? You'll lose access to all sessions and data in this club.`)) return;
    }
    if (!confirm("This cannot be undone. Are you really sure?")) return;

    setLoading(true);
    const { error } = await supabase
      .from("club_members")
      .update({ status: "removed" } as any)
      .eq("id", membershipId);

    if (error) {
      alert("Failed to leave club: " + error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLeave}
      disabled={loading}
      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
    >
      {loading ? "Leaving..." : "Leave Club"}
    </button>
  );
}
