// src/app/api/lectures/[lectureId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import fsp from "fs/promises";
import { Prisma, ResourceType } from "@prisma/client";

export async function GET(_req: Request, ctx: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();

  const lec = await db.lecture.findFirst({
    where: { id: lectureId },
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
      clazz: { select: { userId: true } },
    },
  });

  if (!lec) return NextResponse.json({ error: "Lecture not found" }, { status: 404 });

  if (lec.clazz.userId !== user.id) {
    return NextResponse.json(
      { error: "You do not own this lecture", originalName: lec.originalName },
      { status: 403 }
    );
  }

  return NextResponse.json(lec);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();

  const body = await req.json();
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

  // Find lecture: either in user's class or accessible via syncKey
  const userClasses = await db.class.findMany({
    where: { userId: user.id },
    select: { id: true, syncKey: true },
  });
  const userClassIds = userClasses.map(c => c.id);
  const userSyncKeys = userClasses.map(c => c.syncKey).filter((key): key is string => !!key);

  const lec = await db.lecture.findFirst({
    where: {
      id: lectureId,
      OR: [
        { classId: { in: userClassIds } }, // Owned or in user's class
        { syncKey: { in: userSyncKeys } }, // Imported via syncKey
      ],
    },
    include: { clazz: { select: { userId: true } } },
  });

  if (!lec) return NextResponse.json({ error: "Not found or not in your class" }, { status: 404 });

  if (lec.clazz.userId !== user.id && (descriptor !== undefined || kind !== undefined || originalName !== undefined)) {
    return NextResponse.json({ error: "Cannot modify metadata of non-owned lecture" }, { status: 403 });
  }

  let kindEnum: ResourceType | undefined;
  if (typeof kind === "string") {
    const norm = kind.toUpperCase().trim();
    if ((Object.values(ResourceType) as string[]).includes(norm)) {
      kindEnum = norm as ResourceType;
    } else {
      return NextResponse.json(
        { error: `Invalid kind "${kind}". Expected one of: ${Object.values(ResourceType).join(", ")}` },
        { status: 400 }
      );
    }
  } else if (kind) {
    kindEnum = kind as ResourceType;
  }

  const data: Prisma.LectureUpdateInput = {};
  if (lec.clazz.userId === user.id) {
    if (descriptor !== undefined) data.descriptor = descriptor;
    if (originalName !== undefined && originalName !== null) data.originalName = originalName;
    if (kindEnum !== undefined) data.kind = kindEnum;
  }
  if (typeof includeInMemory === "boolean") data.includeInMemory = includeInMemory;

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