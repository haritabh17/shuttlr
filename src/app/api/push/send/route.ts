import { NextResponse } from "next/server";
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

// POST: send push notification to specific users
// Body: { userIds: string[], title: string, body: string, url?: string, tag?: string }
export async function POST(request: Request) {
  // Verify internal call (from Edge Function or server)
  const authHeader = request.headers.get("authorization") || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!serviceKey || token !== serviceKey.trim()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userIds, title, body, url, tag } = await request.json();

  if (!userIds || !Array.isArray(userIds) || !title) {
    return NextResponse.json({ error: "userIds and title required" }, { status: 400 });
  }

  try {
    ensureVapid();
  } catch (vapidErr: any) {
    return NextResponse.json({ error: "VAPID setup failed", msg: vapidErr.message }, { status: 500 });
  }

  const admin = createAdminClient();

  // Get subscriptions for these users
  const { data: subscriptions, error: subErr } = await (admin as any)
    .from("push_subscriptions")
    .select("*")
    .in("user_id", userIds);

  if (subErr) {
    return NextResponse.json({ error: "DB error", msg: subErr.message }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, reason: "no subscriptions" });
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
    } catch (err: any) {
      errors.push(`${sub.user_id}: ${err.statusCode || err.message}`);
      if (err.statusCode === 410 || err.statusCode === 404) {
        await (admin as any).from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return NextResponse.json({ sent, errors });
}
