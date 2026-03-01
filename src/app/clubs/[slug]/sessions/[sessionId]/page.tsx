import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { GameControls } from "@/components/game-controls";
import { SelectionTimer } from "@/components/selection-timer";
import { CourtView } from "@/components/court-view";
import { PlayerPool } from "@/components/player-pool";
import { RealtimeNotification } from "@/components/realtime-notification";
import { EditSessionSettings } from "@/components/edit-session-settings";
import { NextUpPanel } from "@/components/next-up-panel";

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string; sessionId: string }>;
}) {
  const { slug, sessionId } = await params;
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

  if (!membership) notFound();

  const isManager = membership.role === "manager";

  // Fetch session
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) notFound();

  const endedAt = session.ended_at ? new Date(session.ended_at) : null;
  const canResurrect = session.status === "ended" && endedAt && (Date.now() - endedAt.getTime()) < 24 * 60 * 60 * 1000;
  const isReadOnly = session.status === "ended" && !canResurrect;

  // Fetch session players
  const { data: sessionPlayers } = await supabase
    .from("session_players")
    .select(`
      id,
      status,
      play_count,
      last_played_at,
      user:profiles (
        id,
        full_name,
        gender,
        level
      )
    `)
    .eq("session_id", sessionId);

  // Fetch nickname map from club_members
  const { data: nicknameData } = await (supabase as any)
    .from("club_members")
    .select("user_id, nickname")
    .eq("club_id", club.id)
    .eq("status", "active");

  const nicknameMap: Record<string, string> = {};
  for (const m of nicknameData ?? []) {
    if (m.user_id && m.nickname) nicknameMap[m.user_id] = m.nickname;
  }

  // Enrich session players with nicknames
  const enrichedSessionPlayers = (sessionPlayers ?? []).map((sp: any) => ({
    ...sp,
    user: sp.user ? {
      ...sp.user,
      full_name: nicknameMap[sp.user.id] || sp.user.full_name,
    } : sp.user,
  }));

  // Fetch courts — only show up to number_of_courts configured for this session
  const { data: allCourts } = await supabase
    .from("courts")
    .select("*")
    .eq("club_id", club.id)
    .order("name");

  const courts = (allCourts ?? []).slice(0, session.number_of_courts);

  // Fetch club members (for adding to session)
  const { data: clubMembers } = await supabase
    .from("club_members")
    .select("user_id, user:profiles(id, full_name, gender)")
    .eq("club_id", club.id)
    .eq("status", "active");

  // Fetch current round assignments
  const { data: assignments } = await supabase
    .from("court_assignments")
    .select(`
      id,
      court_id,
      round,
      user:profiles (
        id,
        full_name,
        gender,
        level
      )
    `)
    .eq("session_id", sessionId)
    .order("round", { ascending: false })
    .limit(50);

  // Get the latest round number
  const latestRound = assignments && assignments.length > 0
    ? Math.max(...assignments.map((a) => a.round))
    : 0;

  const enrichedAssignments = (assignments ?? []).map((a: any) => ({
    ...a,
    user: a.user ? {
      ...a.user,
      full_name: nicknameMap[a.user.id] || a.user.full_name,
    } : a.user,
  }));

  const currentAssignments = enrichedAssignments.filter(
    (a: any) => a.round === latestRound && (a as any).assignment_status !== "upcoming"
  );

  // Fetch upcoming (next round) assignments
  const { data: upcomingRaw } = await (supabase as any)
    .from("court_assignments")
    .select(`
      id,
      court_id,
      round,
      assignment_status,
      game_type,
      user:profiles (id, full_name, gender, level)
    `)
    .eq("session_id", sessionId)
    .eq("assignment_status", "upcoming")
    .order("court_id");

  const upcomingAssignments = (upcomingRaw ?? []).map((a: any) => ({
    ...a,
    user: a.user ? {
      ...a.user,
      full_name: nicknameMap[a.user.id] || a.user.full_name,
    } : a.user,
  }));

  // Group upcoming by court for NextUpPanel
  const upcomingByCourtId: Record<string, { name: string; game_type: string | null; players: any[] }> = {};
  let upcomingRound = 0;
  for (const a of upcomingAssignments) {
    if (a.round > upcomingRound) upcomingRound = a.round;
    const court = (courts ?? []).find((c: any) => c.id === a.court_id);
    const courtName = court?.name ?? "Court";
    if (!upcomingByCourtId[a.court_id]) {
      upcomingByCourtId[a.court_id] = { name: courtName, game_type: a.game_type, players: [] };
    }
    if (a.user) {
      upcomingByCourtId[a.court_id].players.push(a.user);
    }
  }
  const upcomingCourts = Object.values(upcomingByCourtId);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Real-time notifications */}
      {session.status === "running" && (
        <RealtimeNotification
          sessionId={sessionId}
          userId={user.id}
          courts={courts.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Home
            </Link>
            <span>/</span>
            <Link
              href={`/clubs/${slug}`}
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {club.name}
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100">{session.name}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {session.name}
              </h1>
              <div className="mt-0.5 flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {session.number_of_courts} courts · {session.play_time_minutes}min play · {session.rest_time_minutes}min rest
                  </p>
                  {isManager && !isReadOnly && <EditSessionSettings session={session as any} />}
                </div>
                {isManager && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    🔀 {(session as any).mixed_ratio ?? 50}% mixed · ⚖️{" "}
                    {((session as any).skill_balance ?? 70) < 30
                      ? "Low"
                      : ((session as any).skill_balance ?? 70) < 70
                        ? "Medium"
                        : "High"}{" "}
                    balance · 🔄 {(session as any).partner_variety ?? 80}% variety
                  </p>
                )}
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                session.status === "running"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : session.status === "paused"
                  ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                  : session.status === "ended"
                  ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
              }`}
            >
              {session.status}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Controls */}
        <GameControls
          session={session}
          isManager={isManager}
          isReadOnly={isReadOnly}
          canResurrect={canResurrect || false}
          clubId={club.id}
          clubSlug={slug}
        />

        {/* Selection Timer */}
        <SelectionTimer
          sessionId={sessionId}
          sessionStatus={session.status}
          playTimeMinutes={session.play_time_minutes}
          restTimeMinutes={session.rest_time_minutes}
          currentPhase={(session as any).current_phase || "idle"}
          currentRoundStartedAt={(session as any).current_round_started_at}
        />

        {/* Courts */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Courts {latestRound > 0 && `(Round ${latestRound})`}
          </h2>
          <CourtView
            courts={courts ?? []}
            assignments={currentAssignments}
            isManager={isManager}
            isReadOnly={isReadOnly}
          />

          {/* Next Up */}
          {upcomingCourts.length > 0 && (
            <NextUpPanel courts={upcomingCourts} round={upcomingRound} isManager={isManager} />
          )}
        </section>

        {/* Player Pool */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Players ({enrichedSessionPlayers.filter((p: any) => p.status !== "removed").length})
          </h2>
          <PlayerPool
            players={enrichedSessionPlayers}
            isManager={isManager}
            sessionId={sessionId}
            currentUserId={user.id}
            clubMembers={(clubMembers ?? []).map((cm: any) => ({
              ...cm,
              user: cm.user ? { ...cm.user, full_name: nicknameMap[cm.user.id] || cm.user.full_name } : cm.user,
            }))}
          />
        </section>
      </main>
    </div>
  );
}
