import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { InviteAcceptClient } from "./client";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  // Look up invite
  const { data: invite } = await admin
    .from("club_invites" as any)
    .select(`
      id, club_id, member_id, email, token, expires_at, used_at,
      club:clubs (name, slug),
      member:club_members (invited_name)
    `)
    .eq("token", token)
    .single() as { data: any };

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Invalid Invitation</h1>
          <p className="mt-2 text-zinc-500">This invitation link is not valid. Please ask your club manager for a new one.</p>
        </div>
      </div>
    );
  }

  if (invite.used_at) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Already Accepted</h1>
          <p className="mt-2 text-zinc-500">This invitation has already been used.</p>
          <a href="/login" className="mt-4 inline-block text-teal-600 hover:underline">Go to login</a>
        </div>
      </div>
    );
  }

  const expired = new Date(invite.expires_at) < new Date();
  if (expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Invitation Expired</h1>
          <p className="mt-2 text-zinc-500">This invitation has expired. Ask your club manager to resend it.</p>
        </div>
      </div>
    );
  }

  // Check if user is already logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const clubName = (invite.club as any)?.name || "a club";
  const clubSlug = (invite.club as any)?.slug || "";
  const playerName = (invite.member as any)?.invited_name || "Player";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">🏸 shuttlrs</h1>
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-lg text-zinc-900 dark:text-zinc-50">
              You&apos;ve been invited to join
            </p>
            <p className="mt-1 text-2xl font-bold text-teal-600">{clubName}</p>
            <p className="mt-2 text-sm text-zinc-500">as {playerName}</p>
          </div>
        </div>

        <InviteAcceptClient
          token={token}
          isLoggedIn={!!user}
          userName={user ? (await admin.from("profiles").select("full_name").eq("id", user.id).single()).data?.full_name || "" : ""}
          clubSlug={clubSlug}
        />
      </div>
    </div>
  );
}
