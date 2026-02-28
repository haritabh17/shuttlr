import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, PRICES } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { clubId, billingCycle } = await req.json();

  if (!clubId || !["monthly", "yearly"].includes(billingCycle)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Verify user is manager of this club
  const { data: membership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "manager") {
    return NextResponse.json({ error: "Only managers can upgrade" }, { status: 403 });
  }

  const priceId = billingCycle === "monthly" ? PRICES.monthly : PRICES.yearly;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${req.nextUrl.origin}/clubs?upgraded=true`,
    cancel_url: `${req.nextUrl.origin}/clubs?upgraded=false`,
    metadata: {
      club_id: clubId,
      user_id: user.id,
    },
    subscription_data: {
      metadata: {
        club_id: clubId,
        user_id: user.id,
      },
    },
    customer_email: user.email ?? undefined,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
