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

  // Get user profile for name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Check if club already has a Stripe customer
  const { data: sub } = await (supabase as any)
    .from("club_subscriptions")
    .select("stripe_customer_id")
    .eq("club_id", clubId)
    .single();

  let customerId = sub?.stripe_customer_id;

  if (!customerId) {
    // Create a Stripe customer with name
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: profile?.full_name ?? undefined,
      metadata: { club_id: clubId, user_id: user.id },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${req.nextUrl.origin}/?upgraded=true`,
    cancel_url: `${req.nextUrl.origin}/`,
    customer: customerId,
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
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
