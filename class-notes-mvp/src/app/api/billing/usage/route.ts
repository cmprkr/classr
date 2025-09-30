// src/app/api/billing/usage/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { getUsageSnapshot } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const wantDebug = url.searchParams.get("debug") === "1";

    const session = await getServerSession(authOptions);
    const uid = (session?.user as any)?.id as string | undefined;
    if (!uid) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const user = await db.user.findUnique({
      where: { id: uid },
      select: { planTier: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const snap = await getUsageSnapshot(uid, user.planTier);

    const body = wantDebug
      ? { ...snap, __note: "debug enabled" }
      : snap;

    return new NextResponse(JSON.stringify(body), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("usage API failed:", e?.message || e);
    return NextResponse.json(
      { error: "usage_failed", detail: e?.message || String(e) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
