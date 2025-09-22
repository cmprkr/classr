import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { email: true, stripeCustomerId: true } });
  if (!user?.email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const c = await stripe.customers.create({ email: user.email, metadata: { userId: session.user.id } });
    customerId = c.id;
    await db.user.update({ where: { id: session.user.id }, data: { stripeCustomerId: customerId } });
  }

  const origin = process.env.NEXTAUTH_URL!.replace(/\/+$/,"");
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account?canceled=1`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: checkout.url });
}
