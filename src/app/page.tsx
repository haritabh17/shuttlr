import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { CreateClubButton } from "@/components/create-club-button";
import { ClubCard } from "@/components/club-card";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Claim any pending club memberships by email (deferred promotions)
  if (user.email) {
    const admin = createAdminClient();
    await admin
      .from("club_members")
      .update({ user_id: user.id, status: "active" } as any)
      .eq("invited_email", user.email)
      .is("user_id", null);
  }

  // Fetch clubs where user is a member
  const { data: memberships } = await supabase
    .from("club_members")
    .select(`
      id,
      role,
      club:clubs (
        id,
        name,
        slug,
        description,
        visibility,
        created_at
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const clubs = memberships?.map((m) => ({
    ...m.club,
    role: m.role,
  })) ?? [];

  const managedClubs = clubs.filter((c) => c.role === "manager");
  const playerClubs = clubs.filter((c) => c.role === "player");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <PushNotificationPrompt />
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Shuttlr" className="h-8 w-8 rounded" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              shuttlr
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/profile"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {user.user_metadata?.full_name || user.email}
            </Link>
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            My Clubs
          </h2>
          <CreateClubButton />
        </div>

        {clubs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400">
              You&apos;re not part of any clubs yet.
            </p>
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
              Create a club to get started, or ask a manager to invite you.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {managedClubs.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Managing
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {managedClubs.map((club) => (
                    <ClubCard key={club.id} club={club} role="manager" />
                  ))}
                </div>
              </section>
            )}

            {playerClubs.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Playing
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {playerClubs.map((club) => (
                    <ClubCard key={club.id} club={club} role="player" />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
