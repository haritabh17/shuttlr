import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  selectPlayers,
  extractPairs,
  type Player,
  type PartnerPair,
  type AlgorithmConfig,
} from "@/lib/selection-engine";

function normalizeGender(
  raw: string | null | undefined
): "male" | "female" | null {
  if (raw === "male" || raw === "M") return "male";
  if (raw === "female" || raw === "F") return "female";
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", session.club_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Only managers can run selection" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: lockRow } = await admin
    .from("sessions")
    .update({ selecting: true } as any)
    .eq("id", sessionId)
    .eq("selecting", false)
    .select("id")
    .single();

  if (!lockRow) {
    return NextResponse.json({ error: "Selection already in progress" }, { status: 409 });
  }

  const releaseLock = () =>
    admin.from("sessions").update({ selecting: false } as any).eq("id", sessionId);

  try {
    const { data: sessionPlayers } = await admin
      .from("session_players")
      .select(
        `id, status, play_count, last_played_at, user_id,
        user:profiles (id, full_name, gender, level)`
      )
      .eq("session_id", sessionId)
      .in("status", ["available", "playing", "resting"]);

    if (!sessionPlayers?.length) {
      await releaseLock();
      return NextResponse.json({ error: "No available players" }, { status: 400 });
    }

    const { data: allCourts } = await admin
      .from("courts")
      .select("*")
      .eq("club_id", session.club_id)
      .order("name");

    const courts = (allCourts ?? [])
      .slice(0, session.number_of_courts)
      .filter((c) => !c.locked);

    if (courts.length === 0) {
      await releaseLock();
      return NextResponse.json({ error: "No unlocked courts available" }, { status: 400 });
    }

    const { data: partnerRows } = await (admin as any)
      .from("partner_history")
      .select("player1_id, player2_id, times_paired")
      .eq("session_id", sessionId);

    const partnerHistory: PartnerPair[] = (partnerRows ?? []).map((r: PartnerPair) => ({
      player1_id: r.player1_id,
      player2_id: r.player2_id,
      times_paired: r.times_paired,
    }));

    const { data: clubMembers } = await admin
      .from("club_members")
      .select("user_id, invited_level, invited_gender")
      .eq("club_id", session.club_id)
      .in("status", ["active", "invited"]);

    const memberLevelMap = new Map<string, number | null>();
    const memberGenderMap = new Map<string, string | null>();
    for (const cm of clubMembers ?? []) {
      if (cm.user_id) {
        memberLevelMap.set(cm.user_id, cm.invited_level);
        memberGenderMap.set(cm.user_id, cm.invited_gender);
      }
    }

    const pool: Player[] = sessionPlayers
      .filter((sp: { user: unknown }) => sp.user)
      .map((sp: { user: { id: string; gender: string | null; level: number | null }; status: string; play_count: number }) => ({
        id: sp.user.id,
        gender: normalizeGender(memberGenderMap.get(sp.user.id) || sp.user.gender),
        level: memberLevelMap.get(sp.user.id) ?? sp.user.level ?? 3,
        games_played: sp.play_count ?? 0,
        is_on_court: sp.status === "playing",
      }));

    const s = session as typeof session & {
      mixed_ratio?: number;
      skill_balance?: number;
      partner_variety?: number;
      strict_gender?: boolean;
    };
    const config: AlgorithmConfig = {
      mixed_ratio: s.mixed_ratio ?? 50,
      skill_balance: s.skill_balance ?? 70,
      partner_variety: s.partner_variety ?? 80,
      strict_gender: s.strict_gender ?? true,
    };

    const { data: pastAssignments } = await (admin as any)
      .from("court_assignments")
      .select("game_type")
      .eq("session_id", sessionId)
      .neq("assignment_status", "upcoming");

    const past = (pastAssignments ?? []) as { game_type: string | null }[];
    const gameTypeHistory = {
      mixed: past.filter((a) => a.game_type === "mixed").length,
      doubles: past.filter((a) => a.game_type === "doubles").length,
    };

    const assignments = selectPlayers(
      pool,
      courts.length,
      config,
      partnerHistory,
      gameTypeHistory
    );

    if (assignments.length === 0) {
      await releaseLock();
      return NextResponse.json({ error: "Could not form any courts" }, { status: 400 });
    }

    const { data: maxRoundData } = await admin
      .from("court_assignments")
      .select("round")
      .eq("session_id", sessionId)
      .order("round", { ascending: false })
      .limit(1);

    const newRound = (maxRoundData?.[0]?.round ?? 0) + 1;

    const assignmentRows: {
      session_id: string;
      court_id: string;
      user_id: string;
      round: number;
      assignment_status: string;
      game_type: string;
    }[] = [];
    const selectedPlayerIds: string[] = [];

    for (const court of assignments) {
      const courtRecord = courts[court.court_index];
      if (!courtRecord) continue;
      for (const player of [...court.team_a, ...court.team_b]) {
        assignmentRows.push({
          session_id: sessionId,
          court_id: courtRecord.id,
          user_id: player.id,
          round: newRound,
          assignment_status: "active",
          game_type: court.game_type,
        });
        if (!selectedPlayerIds.includes(player.id)) {
          selectedPlayerIds.push(player.id);
        }
      }
    }

    if (assignmentRows.length > 0) {
      await admin.from("court_assignments").insert(assignmentRows);

      for (const pair of extractPairs(assignments)) {
        await (admin as any).rpc("increment_partner_history", {
          p_session_id: sessionId,
          p_player1_id: pair.player1_id,
          p_player2_id: pair.player2_id,
        });
      }
    }

    await admin
      .from("session_players")
      .update({ status: "available" })
      .eq("session_id", sessionId)
      .in("status", ["playing", "selected"]);

    await admin
      .from("session_players")
      .update({ status: "available" })
      .eq("session_id", sessionId)
      .eq("status", "sitting_out");

    const now = new Date().toISOString();
    for (const playerId of selectedPlayerIds) {
      const games = pool.find((p) => p.id === playerId)?.games_played ?? 0;
      await admin
        .from("session_players")
        .update({
          status: "playing",
          play_count: games + 1,
          last_played_at: now,
        })
        .eq("session_id", sessionId)
        .eq("user_id", playerId);
    }

    await admin
      .from("sessions")
      .update({
        current_round_started_at: now,
        current_phase: "playing",
        selecting: false,
        next_round_selected: false,
      } as any)
      .eq("id", sessionId);

    await admin.from("events").insert({
      club_id: session.club_id,
      session_id: sessionId,
      actor_id: user.id,
      actor_type: "human",
      event_type: "selection_run",
      payload: {
        round: newRound,
        assignment_status: "active",
        courts: assignments.length,
      },
    });

    return NextResponse.json({
      round: newRound,
      courts: assignments.length,
    });
  } catch (err) {
    await releaseLock();
    throw err;
  }
}
