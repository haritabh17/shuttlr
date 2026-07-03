import { createAdminClient } from "@/lib/supabase/admin";
import webpush from "web-push";

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").replace(/=+$/, "");
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").replace(/=+$/, "");
  webpush.setVapidDetails(process.env.VAPID_MAILTO || "mailto:noreply@shuttlrs.com", publicKey, privateKey);
  vapidConfigured = true;
}

export interface SendPushParams {
  userIds: string[];
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

export interface SendPushResult {
  sent: number;
  errors: string[];
}

// Send a web-push notification to every subscription of the given users.
// Throws if VAPID keys are missing/invalid or the subscription lookup fails;
// per-subscription delivery failures are collected in `errors` instead.
export async function sendPushToUsers({
  userIds,
  title,
  body,
  url,
  tag,
}: SendPushParams): Promise<SendPushResult> {
  ensureVapid();

  // push_subscriptions is missing from the stale generated Database types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: subscriptions, error: subErr } = await admin
    .from("push_subscriptions")
    .select("*")
    .in("user_id", userIds);

  if (subErr) {
    throw new Error(`push subscription lookup failed: ${subErr.message}`);
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, errors: [] };
  }

  const payload = JSON.stringify({ title, body, url, tag });
  let sent = 0;
  const errors: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      sent++;
    } catch (err) {
      const e = err as { statusCode?: number; message?: string };
      errors.push(`${sub.user_id}: ${e.statusCode || e.message}`);
      // Subscription is gone — clean it up
      if (e.statusCode === 410 || e.statusCode === 404) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return { sent, errors };
}
