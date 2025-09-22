import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { getUsageSnapshot } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const uid = (session?.user as any)?.id as string | undefined;
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({
      where: { id: uid },
      select: { planTier: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const snap = await getUsageSnapshot(uid, user.planTier);
    return NextResponse.json(snap);
  } catch (e: any) {
    console.error("usage API failed:", e?.message || e);
    return NextResponse.json({ error: "usage_failed", detail: e?.message || String(e) }, { status: 500 });
  }
}
