"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function AddMemberButton({ clubId }: { clubId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("M");
  const [level, setLevel] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Check if user exists by email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    // Check if there's an existing (possibly removed) membership
    const { data: existing } = await supabase
      .from("club_members")
      .select("id, status, invited_name")
      .eq("club_id", clubId)
      .or(profile ? `user_id.eq.${profile.id},invited_email.eq.${email}` : `invited_email.eq.${email}`)
      .single();

    if (existing) {
      if (existing.status === "removed") {
        const memberName = existing.invited_name || name || email;
        if (!confirm(`${memberName} was previously removed from this club. Re-activate their membership?`)) {
          setLoading(false);
          return;
        }
        // Re-activate
        const { error: reactivateErr } = await supabase
          .from("club_members")
          .update({
            status: "active",
            role: "player",
            user_id: profile?.id || null,
            invited_name: name || existing.invited_name,
            invited_gender: gender,
            invited_level: level,
          })
          .eq("id", existing.id);

        if (reactivateErr) {
          setError(reactivateErr.message);
          setLoading(false);
          return;
        }
      } else {
        setError("This person is already a member of this club.");
        setLoading(false);
        return;
      }
    } else {
      const { error: err } = await supabase.from("club_members").insert({
        club_id: clubId,
        user_id: profile?.id || null,
        invited_email: email,
        invited_name: name,
        invited_gender: gender,
        invited_level: level,
        role: "player",
        status: profile ? "active" : "invited",
      });

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    setOpen(false);
    setEmail("");
    setName("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Add Member
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Add Member
        </h3>

        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="player@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Full name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Level (1-10)
              </label>
              <input
                type="number"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                min={1}
                max={10}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
