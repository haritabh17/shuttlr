import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS } from "@/lib/limits";

export type PlanLimits = (typeof LIMITS)[keyof typeof LIMITS];

export async function getClubIsPro(clubId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await (admin as any)
    .from("club_subscriptions")
    .select("status")
    .eq("club_id", clubId)
    .in("status", ["active"])
    .maybeSingle();
  return !!data;
}

export async function getLimitsForClub(clubId: string): Promise<PlanLimits> {
  const isPro = await getClubIsPro(clubId);
  return isPro ? LIMITS.pro : LIMITS.free;
}

export async function userHasAnyProClub(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: managedClubs } = await (admin as any)
    .from("club_members")
    .select("club_id, clubs!inner(deleted_at)")
    .eq("user_id", userId)
    .eq("role", "manager")
    .eq("status", "active")
    .is("clubs.deleted_at", null);

  const clubIds = (managedClubs ?? []).map((m: { club_id: string }) => m.club_id);
  if (clubIds.length === 0) return false;

  const { data: subs } = await (admin as any)
    .from("club_subscriptions")
    .select("club_id")
    .in("club_id", clubIds)
    .in("status", ["active"]);

  return (subs?.length ?? 0) > 0;
}

export async function countActiveMembers(clubId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("club_members")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .in("status", ["active", "invited"]);
  return count ?? 0;
}

export async function countTotalSessions(clubId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId);
  return count ?? 0;
}

export async function countRunningSessions(
  clubId: string,
  excludeSessionId?: string
): Promise<number> {
  const admin = createAdminClient();
  let q = admin
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("status", "running");
  if (excludeSessionId) {
    q = q.neq("id", excludeSessionId);
  }
  const { count } = await q;
  return count ?? 0;
}

export async function assertMemberCapacity(
  clubId: string,
  additional = 1
): Promise<{ ok: true } | { ok: false; error: string }> {
  const limits = await getLimitsForClub(clubId);
  const current = await countActiveMembers(clubId);
  if (current + additional > limits.members) {
    return {
      ok: false,
      error: `Member limit reached (${limits.members}). Upgrade to Pro for up to ${LIMITS.pro.members} members.`,
    };
  }
  return { ok: true };
}

export async function assertSessionCapacity(
  clubId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const limits = await getLimitsForClub(clubId);
  const current = await countTotalSessions(clubId);
  if (current >= limits.totalSessions) {
    return {
      ok: false,
      error: `Session limit reached (${limits.totalSessions}). Upgrade to Pro for up to ${LIMITS.pro.totalSessions} sessions.`,
    };
  }
  return { ok: true };
}

export async function assertConcurrentSessions(
  clubId: string,
  excludeSessionId?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const limits = await getLimitsForClub(clubId);
  const running = await countRunningSessions(clubId, excludeSessionId);
  if (running >= limits.concurrentSessions) {
    return {
      ok: false,
      error: `Concurrent session limit reached (${limits.concurrentSessions}). End another session first${
        limits.concurrentSessions === 1 ? " or upgrade to Pro" : ""
      }.`,
    };
  }
  return { ok: true };
}
