import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(req: Request) {
  const sig = headers().get("stripe-signature")!;
  const raw = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e: any) {
    return new NextResponse(`Webhook Error: ${e.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const subId = s.subscription as string;
        const customerId = s.customer as string;
        // Look up user by customer metadata or email
        let user = await db.user.findFirst({ where: { stripeCustomerId: customerId } });
        if (!user && s.customer_details?.email) {
          user = await db.user.findFirst({ where: { email: s.customer_details.email } });
        }
        if (user) {
          await db.user.update({
            where: { id: user.id },
            data: { planTier: "PREMIUM", planStatus: "active", stripeCustomerId: customerId, stripeSubscriptionId: subId },
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status;
        const customerId = sub.customer as string;
        await db.user.updateMany({ where: { stripeCustomerId: customerId }, data: { planStatus: status, planTier: status === "active" ? "PREMIUM" : "FREE", stripeSubscriptionId: sub.id } });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        await db.user.updateMany({ where: { stripeCustomerId: customerId }, data: { planTier: "FREE", planStatus: "canceled", stripeSubscriptionId: null } });
        break;
      }
      default:
        // ignore other events
        break;
    }
  } catch (e: any) {
    console.error("stripe webhook error:", e?.message || e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
