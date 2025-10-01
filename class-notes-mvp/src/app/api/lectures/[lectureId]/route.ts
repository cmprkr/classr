//src/app/api/lectures/[lectureId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import fsp from "fs/promises";
import { Prisma, ResourceType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: allow owner OR anyone whose classes share the lecture's syncKey */
export async function GET(_req: Request, ctx: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();

  // Viewer’s classes & sync keys
  const viewerClasses = await db.class.findMany({
    where: { userId: user.id },
    select: { id: true, syncKey: true },
  });
  const viewerClassIds = viewerClasses.map((c) => c.id);
  const viewerSyncKeys = viewerClasses.map((c) => c.syncKey).filter((v): v is string => !!v);

  const lec = await db.lecture.findFirst({
    where: {
      id: lectureId,
      OR: [
        { classId: { in: viewerClassIds } },
        { syncKey: { in: viewerSyncKeys } },
      ],
    },
    select: {
      id: true,
      classId: true,
      originalName: true,
      descriptor: true,
      kind: true,
      mime: true,
      status: true,
      durationSec: true,
      includeInMemory: true, // legacy
      createdAt: true,
      updatedAt: true,
      transcript: true,
      textContent: true,
      summaryJson: true,
      syncKey: true,

      // ✅ include the actual lecture creator
      user: { select: { id: true, name: true, username: true } },

      // class & class owner
      clazz: {
        select: {
          userId: true,
          scheduleJson: true,
          isActive: true, // ⬅️ add this
          user: { select: { id: true, name: true, username: true } },
        },
      },

      // fetch THIS viewer's pref (if any)
      userPrefs: {
        where: { userId: user.id },
        select: { includeInAISummary: true },
        take: 1,
      },
    },
  });

  if (!lec) {
    return NextResponse.json({ error: "Not found or not accessible" }, { status: 404 });
  }

  const viewerIncludeInAISummary =
    lec.userPrefs?.[0]?.includeInAISummary ??
    // fallback to legacy if present, else true
    (typeof lec.includeInMemory === "boolean" ? lec.includeInMemory : true);

  return NextResponse.json({
    ...lec,
    viewerIncludeInAISummary,
    // ✅ return the lecture creator as uploader; fallback to class owner if null
    uploader: lec.user ?? lec.clazz.user,
    uploaderScheduleJson: lec.clazz.scheduleJson,
    clazzIsActive: lec.clazz.isActive, // ⬅️ add this
  });
}

/** PATCH: owner can mutate metadata; legacy includeInMemory kept for back-compat */
export async function PATCH(req: Request, ctx: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();
  const body = await req.json().catch(() => ({} as any));

  const {
    descriptor,
    kind,
    originalName,
    includeInMemory, // legacy
  }: {
    descriptor?: string | null;
    kind?: ResourceType | string | null;
    originalName?: string | null;
    includeInMemory?: boolean | null;
  } = body ?? {};

  // Viewer’s classes & sync keys
  const viewerClasses = await db.class.findMany({
    where: { userId: user.id },
    select: { id: true, syncKey: true },
  });
  const viewerClassIds = viewerClasses.map((c) => c.id);
  const viewerSyncKeys = viewerClasses.map((c) => c.syncKey).filter((v): v is string => !!v);

  const lec = await db.lecture.findFirst({
    where: {
      id: lectureId,
      OR: [
        { classId: { in: viewerClassIds } },
        { syncKey: { in: viewerSyncKeys } },
      ],
    },
    include: { clazz: { select: { userId: true } } },
  });
  if (!lec) {
    return NextResponse.json({ error: "Not found or not accessible" }, { status: 404 });
  }

  // Only owner can change descriptor/kind/originalName
  const owner = lec.clazz.userId === user.id;

  let kindEnum: ResourceType | undefined;
  if (typeof kind === "string") {
    const norm = kind.toUpperCase().trim();
    if ((Object.values(ResourceType) as string[]).includes(norm)) {
      kindEnum = norm as ResourceType;
    } else if (kind != null) {
      return NextResponse.json(
        { error: `Invalid kind "${kind}". Expected one of: ${Object.values(ResourceType).join(", ")}` },
        { status: 400 }
      );
    }
  } else if (kind) {
    kindEnum = kind as ResourceType;
  }

  const data: Prisma.LectureUpdateInput = {};
  if (owner) {
    if (descriptor !== undefined) data.descriptor = descriptor;
    if (originalName !== undefined && originalName !== null) data.originalName = originalName;
    if (kindEnum !== undefined) data.kind = kindEnum;
    // keep legacy writes if someone still calls this
    if (typeof includeInMemory === "boolean") data.includeInMemory = includeInMemory;
  } else if (descriptor !== undefined || originalName !== undefined || kindEnum !== undefined) {
    return NextResponse.json({ error: "Cannot modify metadata of non-owned lecture" }, { status: 403 });
  }

  const updated = await db.lecture.update({
    where: { id: lectureId },
    data,
    select: {
      id: true,
      classId: true,
      originalName: true,
      descriptor: true,
      kind: true,
      includeInMemory: true, // legacy
      updatedAt: true,
    },
  });

  return NextResponse.json(updated);
}

/** DELETE: owner only */
export async function DELETE(_req: Request, ctx: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();

  const lec = await db.lecture.findFirst({
    where: { id: lectureId, clazz: { userId: user.id } },
  });
  if (!lec) return NextResponse.json({ ok: true });

  if (lec.filePath) {
    await fsp.unlink(lec.filePath).catch(() => {});
  }

  await db.$transaction([
    db.chunk.deleteMany({ where: { lectureId } }),
    db.lecture.delete({ where: { id: lectureId } }),
  ]);

  return NextResponse.json({ ok: true });
}
