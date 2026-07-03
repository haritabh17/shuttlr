import { NextResponse } from "next/server";
import { sendPushToUsers } from "@/lib/push";

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
    const result = await sendPushToUsers({ userIds, title, body, url, tag });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Push send failed", msg: (err as Error).message },
      { status: 500 }
    );
  }
}
