// src/app/api/lectures/[lectureId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import fsp from "fs/promises";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ lectureId: string }> }
) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // allow empty body
  }

  const { descriptor, kind, includeInMemory } = body ?? {};

  // Ownership guard — relation is `clazz` in your schema
  const lec = await db.lecture.findFirst({
    where: { id: lectureId, clazz: { userId: user.id } },
    select: { id: true },
  });
  if (!lec) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: any = {};
  if (typeof descriptor !== "undefined") data.descriptor = descriptor ?? undefined;
  if (typeof kind !== "undefined") data.kind = kind ?? undefined; // enum key expected
  if (typeof includeInMemory === "boolean") data.includeInMemory = includeInMemory;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no changes" }, { status: 400 });
  }

  const updated = await db.lecture.update({
    where: { id: lectureId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ lectureId: string }> }
) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();

  // Ownership guard — relation is `clazz` in your schema
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
