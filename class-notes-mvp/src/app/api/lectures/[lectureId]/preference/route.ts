// src/app/api/lectures/[lectureId]/preference/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Access guard: owner or shares syncKey with viewer
async function ensureAccess(userId: string, lectureId: string) {
  const viewerClasses = await db.class.findMany({
    where: { userId },
    select: { id: true, syncKey: true },
  });
  const viewerClassIds = viewerClasses.map((c) => c.id);
  const viewerSyncKeys = viewerClasses.map((c) => c.syncKey).filter((v): v is string => !!v);

  const canSee = await db.lecture.findFirst({
    where: {
      id: lectureId,
      OR: [
        { classId: { in: viewerClassIds } },
        { syncKey: { in: viewerSyncKeys } },
      ],
    },
    select: { id: true },
  });
  return Boolean(canSee);
}

// GET: return this viewer's flag; default true when missing
export async function GET(_req: Request, ctx: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();

  const allowed = await ensureAccess(user.id, lectureId);
  if (!allowed) return NextResponse.json({ error: "Not found or not accessible" }, { status: 404 });

  const pref = await db.lectureUserPref.findUnique({
    where: { lectureId_userId: { lectureId, userId: user.id } },
    select: { includeInAISummary: true },
  });

  return NextResponse.json({
    includeInAISummary: pref?.includeInAISummary ?? true,
  });
}

// PATCH: upsert this viewer's flag
export async function PATCH(req: Request, ctx: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();
  const body = await req.json().catch(() => ({} as any));

  const { includeInAISummary } = body as { includeInAISummary?: boolean };
  if (typeof includeInAISummary !== "boolean") {
    return NextResponse.json({ error: "includeInAISummary boolean required" }, { status: 400 });
  }

  const allowed = await ensureAccess(user.id, lectureId);
  if (!allowed) return NextResponse.json({ error: "Not found or not accessible" }, { status: 404 });

  const saved = await db.lectureUserPref.upsert({
    where: { lectureId_userId: { lectureId, userId: user.id } },
    create: { lectureId, userId: user.id, includeInAISummary },
    update: { includeInAISummary },
    select: { includeInAISummary: true },
  });

  return NextResponse.json(saved);
}
