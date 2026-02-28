"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClubVisibility({
  clubId,
  currentVisibility,
}: {
  clubId: string;
  currentVisibility: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true);
    await supabase
      .from("clubs")
      .update({ visibility: e.target.value })
      .eq("id", clubId);
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      defaultValue={currentVisibility}
      onChange={handleChange}
      disabled={saving}
      className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 capitalize dark:bg-zinc-800 dark:text-zinc-400 border-none cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
    >
      <option value="public">Public</option>
      <option value="private">Private</option>
      <option value="invite-only">Invite Only</option>
    </select>
  );
}
