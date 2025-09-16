// src/app/api/lectures/[lectureId]/route.ts
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
        { classId: { in: viewerClassIds } }, // in viewer's class (owner or imported)
        { syncKey: { in: viewerSyncKeys } }, // shared via syncKey
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
      includeInMemory: true,
      createdAt: true,
      updatedAt: true,
      transcript: true,
      textContent: true,
      summaryJson: true,
      syncKey: true,
      clazz: {
        select: {
          userId: true,
          scheduleJson: true,                      // uploader’s schedule
          user: { select: { id: true, name: true, username: true } },
        },
      },
    },
  });

  if (!lec) {
    return NextResponse.json({ error: "Not found or not accessible" }, { status: 404 });
  }

  return NextResponse.json({
    ...lec,
    uploader: lec.clazz.user,
    uploaderScheduleJson: lec.clazz.scheduleJson,
  });
}

/** PATCH: owner can mutate metadata; anyone with access can toggle includeInMemory */
export async function PATCH(req: Request, ctx: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();
  const body = await req.json().catch(() => ({} as any));

  const {
    descriptor,
    kind,
    originalName,
    includeInMemory,
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
  } else if (descriptor !== undefined || originalName !== undefined || kindEnum !== undefined) {
    return NextResponse.json({ error: "Cannot modify metadata of non-owned lecture" }, { status: 403 });
  }

  if (typeof includeInMemory === "boolean") {
    data.includeInMemory = includeInMemory;
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
      includeInMemory: true,
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
