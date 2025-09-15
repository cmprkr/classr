// src/app/api/lectures/[lectureId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import fsp from "fs/promises";
import { Prisma, ResourceType } from "@prisma/client";

// --- GET: fetch a lecture (for settings panel) ---
export async function GET(_req: Request, ctx: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();

  const lec = await db.lecture.findFirst({
    where: { id: lectureId, clazz: { userId: user.id } },
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
    },
  });

  if (!lec) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(lec);
}

// --- PATCH: update descriptor/kind/name/includeInMemory ---
export async function PATCH(req: Request, ctx: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();

  const body = await req.json();
  const {
    descriptor,                 // string | null | undefined
    kind,                       // ResourceType | string | null | undefined
    originalName,               // string | null | undefined
    includeInMemory,            // boolean | null | undefined (we'll ignore null)
  }: {
    descriptor?: string | null;
    kind?: ResourceType | string | null;
    originalName?: string | null;
    includeInMemory?: boolean | null;
  } = body ?? {};

  const lec = await db.lecture.findFirst({
    where: { id: lectureId, clazz: { userId: user.id } },
  });
  if (!lec) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Normalize/validate enum
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

  // Build update payload (only set fields that were provided)
  const data: Prisma.LectureUpdateInput = {};
  if (descriptor !== undefined) data.descriptor = descriptor;                 // allow null to clear
  if (originalName !== undefined && originalName !== null) data.originalName = originalName;
  if (typeof includeInMemory === "boolean") data.includeInMemory = includeInMemory; // <-- fix: boolean only
  if (kindEnum !== undefined) data.kind = kindEnum;

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

// --- DELETE: remove lecture and its chunks (and file if present) ---
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
