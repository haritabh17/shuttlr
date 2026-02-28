import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { MemberList } from "@/components/member-list";
import { SessionList } from "@/components/session-list";
import { CreateSessionButton } from "@/components/create-session-button";
import { AddMemberButton } from "@/components/add-member-button";
import { EventLog } from "@/components/event-log";
import { DeletedSessions } from "@/components/deleted-sessions";
import { LeaveClubButton } from "@/components/leave-club-button";
import { UpgradeButton } from "@/components/upgrade-button";

export default async function ClubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch club
  const { data: club } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!club) notFound();

  // Check membership
  const { data: membership } = await supabase
    .from("club_members")
    .select("*")
    .eq("club_id", club.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Access Denied
          </h1>
          <p className="mt-2 text-zinc-500">
            You&apos;re not a member of this club.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const isManager = membership.role === "manager";

  // Fetch members
  const { data: members } = await (supabase as any)
    .from("club_members")
    .select(`
      id,
      role,
      status,
      nickname,
      invited_name,
      invited_gender,
      invited_level,
      user:profiles (
        id,
        full_name,
        email,
        gender,
        level
      )
    `)
    .eq("club_id", club.id)
    .eq("status", "active")
    .order("role", { ascending: true });

  // Fetch sessions (exclude soft-deleted)
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("club_id", club.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Fetch subscription and usage
  const { data: subscription } = await (supabase as any)
    .from("club_subscriptions")
    .select("plan, status, trial_ends_at, billing_cycle, current_period_end, stripe_customer_id")
    .eq("club_id", club.id)
    .single();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: usage } = await (supabase as any)
    .from("session_usage")
    .select("session_count")
    .eq("club_id", club.id)
    .eq("month", currentMonth)
    .single();

  // Fetch soft-deleted sessions (within 1 month) for managers
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: deletedSessions } = isManager
    ? await supabase
        .from("sessions")
        .select("*")
        .eq("club_id", club.id)
        .not("deleted_at", "is", null)
        .gte("deleted_at", oneMonthAgo)
        .order("deleted_at", { ascending: false })
    : { data: [] };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Home
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100">{club.name}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {club.name}
              </h1>
              {club.description && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {club.description}
                </p>
              )}
            </div>

          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {/* Subscription Banner */}
        {isManager && (
          <UpgradeButton
            clubId={club.id}
            subscription={subscription}
            sessionCount={usage?.session_count ?? 0}
          />
        )}

        {/* Sessions Section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Sessions
            </h2>
            {isManager && <CreateSessionButton clubId={club.id} clubName={club.name} />}
          </div>
          <SessionList sessions={sessions ?? []} clubSlug={club.slug} />
        </section>

        {/* Members Section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Members ({members?.length ?? 0})
            </h2>
            {isManager && <AddMemberButton clubId={club.id} />}
          </div>
          <MemberList members={members ?? []} isManager={isManager} clubId={club.id} />
        </section>
        {/* Deleted Sessions (managers only) */}
        {isManager && deletedSessions && deletedSessions.length > 0 && (
          <DeletedSessions sessions={deletedSessions} clubSlug={club.slug} />
        )}

        {/* Event Log */}
        <details className="group">
          <summary className="mb-4 cursor-pointer list-none text-lg font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <span className="transition-transform group-open:rotate-90">▶</span>
            Activity Log
          </summary>
          <EventLog clubId={club.id} />
        </details>

        {/* Leave Club — anyone can leave unless they're the last member */}
        {(members?.length ?? 0) > 1 && (
          <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <LeaveClubButton clubId={club.id} clubName={club.name} membershipId={membership.id} isManager={isManager} />
          </div>
        )}
      </main>
    </div>
  );
}
