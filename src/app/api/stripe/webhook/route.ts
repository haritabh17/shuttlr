import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clubId = session.metadata?.club_id;
      if (!clubId || !session.subscription) break;

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as AnyObj;

      await (admin as any)
        .from("club_subscriptions")
        .update({
          plan: "pro",
          status: "active",
          billing_cycle: subscription.items.data[0]?.price?.recurring?.interval === "month" ? "monthly" : "yearly",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("club_id", clubId);

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as AnyObj;
      const clubId = subscription.metadata?.club_id;
      if (!clubId) break;

      const status = subscription.status === "active" ? "active" :
                     subscription.status === "past_due" ? "past_due" :
                     subscription.status === "canceled" ? "canceled" : "active";

      await (admin as any)
        .from("club_subscriptions")
        .update({
          status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("club_id", clubId);

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as AnyObj;
      const clubId = subscription.metadata?.club_id;
      if (!clubId) break;

      await (admin as any)
        .from("club_subscriptions")
        .update({
          plan: "free",
          status: "canceled",
          canceled_at: new Date().toISOString(),
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("club_id", clubId);

      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as AnyObj;
      const subId = invoice.subscription as string;
      if (!subId) break;

      await (admin as any)
        .from("club_subscriptions")
        .update({
          status: "past_due",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subId);

      break;
    }
  }

  return NextResponse.json({ received: true });
}
