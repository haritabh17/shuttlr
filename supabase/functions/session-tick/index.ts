// Supabase Edge Function: session-tick
// Triggered by pg_cron via pg_net every ~10 seconds.
// Handles phase transitions, player selection, and next-round pre-selection.
// Selection itself lives in ../_shared/selection-run.ts, shared with the
// manual-select API route in the Next.js app.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";
import {
  acquireSessionLock,
  getMaxRound,
  releaseSessionLock,
  runSelection,
  syncPlayerStatuses,
  type PushGroup,
  type SelectionContext,
  type SupabaseLike,
} from "../_shared/selection-run.ts";

const MAX_SESSION_MS = 6 * 60 * 60 * 1000; // 6 hours

Deno.serve(async (req) => {
  console.log("[tick] Invoked at", new Date().toISOString());
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const url = new URL(req.url);
  const providedSecret =
    url.searchParams.get("secret") || req.headers.get("x-cron-secret");

  if (
    cronSecret &&
    providedSecret !== cronSecret &&
    authHeader !== `Bearer ${serviceRoleKey}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("status", "running")
    .eq("selecting", false);

  if (error || !sessions) {
    return Response.json(
      { error: error?.message ?? "no sessions" },
      { status: 500 },
    );
  }

  console.log(`[tick] Found ${sessions.length} running session(s)`);
  const results: string[] = [];

  for (const session of sessions) {
    try {
      console.log(`[tick] Processing session ${session.id}, phase=${session.current_phase}, round_started=${session.current_round_started_at}`);
      const result = await processSession(supabase, session, serviceRoleKey);
      if (result) { console.log(`[tick] ${session.id}: ${result}`); results.push(`${session.id}: ${result}`); }
    } catch (err) {
      console.error(`[tick] ERROR processing session ${session.id}:`, (err as Error).message, (err as Error).stack);
      results.push(`${session.id}: error - ${(err as Error).message}`);
    }
  }

  return Response.json({ processed: sessions.length, transitions: results });
});

type TickAction =
  | { type: "auto-end" }
  | { type: "select"; status: "active" | "upcoming" }
  | { type: "rest" }
  | { type: "promote-or-select" };

/**
 * Pure decision: what (if anything) does this session need right now?
 * Deliberately ignores `selecting` — the caller handles locking.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decideAction(session: any): TickAction | null {
  const started = session.started_at
    ? new Date(session.started_at).getTime()
    : null;
  if (started && Date.now() - started >= MAX_SESSION_MS) {
    return { type: "auto-end" };
  }

  const phase = session.current_phase || "idle";
  const roundStarted = session.current_round_started_at
    ? new Date(session.current_round_started_at).getTime()
    : null;

  if (phase === "idle" || !roundStarted) {
    return { type: "select", status: "active" };
  }

  const elapsed = Date.now() - roundStarted;

  if (phase === "playing") {
    const playMs = session.play_time_minutes * 60 * 1000;
    const selectionMs =
      (session.selection_interval_minutes ?? session.play_time_minutes) * 60 * 1000;

    // Mid-round: fire next-round selection at selection_interval
    if (
      !session.next_round_selected &&
      selectionMs < playMs &&
      elapsed >= selectionMs
    ) {
      return { type: "select", status: "upcoming" };
    }

    if (elapsed >= playMs) {
      return session.rest_time_minutes > 0
        ? { type: "rest" }
        : { type: "promote-or-select" };
    }
  } else if (phase === "resting") {
    const restMs = session.rest_time_minutes * 60 * 1000;
    if (elapsed >= restMs) {
      return { type: "promote-or-select" };
    }
  }

  return null;
}

async function processSession(
  supabase: SupabaseLike,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any,
  serviceRoleKey: string,
): Promise<string | null> {
  // Idle tick: nothing due, don't touch the row (avoids a write + realtime
  // event every 10s for every running session)
  if (!decideAction(session)) return null;

  // Hold the session's `selecting` lock across the whole mutation so an
  // overlapping cron invocation (or a manager's manual select) can't
  // double-promote or double-select.
  if (!(await acquireSessionLock(supabase, session.id))) {
    console.log(`[tick] ${session.id}: locked by another invocation, skipping`);
    return null;
  }

  try {
    // Re-read and re-decide under the lock: another invocation may have
    // already performed this transition between our list query and now.
    const { data: fresh } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", session.id)
      .single();
    if (!fresh || fresh.status !== "running") return null;

    const action = decideAction(fresh);
    if (!action) return null;

    const ctx: SelectionContext = {
      supabase,
      sendPush: makePushSender(serviceRoleKey),
    };
    const phase = fresh.current_phase || "idle";

    switch (action.type) {
      case "auto-end": {
        await supabase
          .from("sessions")
          .update({
            status: "ended",
            ended_at: new Date().toISOString(),
            current_phase: "idle",
          })
          .eq("id", fresh.id);

        await logEvent(supabase, fresh, "session_auto_ended", {
          reason: "6h time limit",
        });
        return "auto-ended (6h limit)";
      }

      case "select": {
        const result = await runSelection(ctx, fresh, action.status);
        if (!result.ok) {
          return `${phase} → selection skipped (${result.reason})`;
        }
        return action.status === "upcoming"
          ? "mid-round → next round selected"
          : `${phase} → selection → playing`;
      }

      case "rest": {
        await supabase
          .from("sessions")
          .update({
            current_phase: "resting",
            current_round_started_at: new Date().toISOString(),
            next_round_selected: false,
          })
          .eq("id", fresh.id);
        return "playing → resting";
      }

      case "promote-or-select": {
        await promoteOrSelect(ctx, fresh);
        return `${phase} → selection → playing`;
      }
    }

    return null;
  } finally {
    await releaseSessionLock(supabase, session.id);
  }
}

/**
 * If upcoming assignments exist, promote them to active.
 * Otherwise run a fresh selection.
 * Caller must hold the session lock.
 */
async function promoteOrSelect(
  ctx: SelectionContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any,
) {
  const { supabase } = ctx;
  const { data: upcoming } = await supabase
    .from("court_assignments")
    .select("id")
    .eq("session_id", session.id)
    .eq("assignment_status", "upcoming")
    .limit(1);

  if (!upcoming || upcoming.length === 0) {
    // No upcoming — run fresh selection
    await runSelection(ctx, session, "active");
    return;
  }

  // Everyone from the previous round — and one-round sit-outs — returns to the pool
  await supabase
    .from("session_players")
    .update({ status: "available" })
    .eq("session_id", session.id)
    .in("status", ["playing", "selected", "sitting_out"]);

  // Promote upcoming → active
  await supabase
    .from("court_assignments")
    .update({ assignment_status: "active" })
    .eq("session_id", session.id)
    .eq("assignment_status", "upcoming");

  // Mark the promoted players playing and increment play counts in one call
  const round = await getMaxRound(supabase, session.id);
  const { data: promoted } = await supabase
    .from("court_assignments")
    .select("user_id")
    .eq("session_id", session.id)
    .eq("assignment_status", "active")
    .eq("round", round);

  const userIds: string[] = [
    ...new Set<string>((promoted ?? []).map((a: { user_id: string }) => a.user_id)),
  ];
  if (userIds.length > 0) {
    await supabase.rpc("begin_round_players", {
      p_session_id: session.id,
      p_user_ids: userIds,
    });
  }

  await supabase
    .from("sessions")
    .update({
      current_round_started_at: new Date().toISOString(),
      current_phase: "playing",
      next_round_selected: false,
    })
    .eq("id", session.id);

  // Sync statuses to catch any manual swaps
  await syncPlayerStatuses(supabase, session.id);

  // No push here — players already got "You're up next!" when upcoming was selected
}

function makePushSender(serviceRoleKey: string): (group: PushGroup) => Promise<void> {
  const appUrl = Deno.env.get("APP_URL") || "https://beta.shuttlrs.com";
  return async (group) => {
    try {
      await fetch(`${appUrl}/api/push/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          userIds: group.userIds,
          title: group.title,
          body: group.body,
          tag: group.tag,
          url: group.url,
        }),
      });
    } catch (err) {
      console.error("Push batch failed:", err);
    }
  };
}

async function logEvent(
  supabase: SupabaseLike,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any,
  eventType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  await supabase.from("events").insert({
    club_id: session.club_id,
    session_id: session.id,
    actor_id: null,
    actor_type: "system",
    event_type: eventType,
    payload,
  });
}
