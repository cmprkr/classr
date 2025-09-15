// src/app/api/classes/[classId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import fsp from "fs/promises";

export async function GET(_req: Request, ctx: { params: Promise<{ classId: string }> }) {
  const { classId } = await ctx.params;
  const user = await requireUser();

  const clazz = await db.class.findFirst({
    where: { id: classId, userId: user.id },
    select: {
      id: true,
      name: true,
      syncEnabled: true,
      syncKey: true,
    },
  });
  if (!clazz) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(clazz);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ classId: string }> }) {
  const { classId } = await ctx.params;
  const user = await requireUser();
  const body = await req.json();

  const { name, syncEnabled, syncKey } = body as {
    name?: string;
    syncEnabled?: boolean;
    syncKey?: string | null;
  };

  const clazz = await db.class.findFirst({
    where: { id: classId, userId: user.id },
  });
  if (!clazz) return NextResponse.json({ error: "not found" }, { status: 404 });

  const updated = await db.class.update({
    where: { id: classId },
    data: {
      ...(typeof name === "string" ? { name } : {}),
      ...(typeof syncEnabled === "boolean" ? { syncEnabled } : {}),
      // store null or a valid key; if syncEnabled is false, you may want to null it out too
      ...(syncKey !== undefined ? { syncKey } : {}),
    },
    select: { id: true, name: true, syncEnabled: true, syncKey: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ classId: string }> }) {
  const { classId } = await ctx.params;
  const user = await requireUser();

  const clazz = await db.class.findFirst({
    where: { id: classId, userId: user.id },
    include: { lectures: true },
  });
  if (!clazz) return NextResponse.json({ ok: true });

  // delete files first
  await Promise.all(
    clazz.lectures
      .map((l) => l.filePath)
      .filter(Boolean)
      .map((fp) => fsp.unlink(fp!).catch(() => {}))
  );

  await db.$transaction([
    db.chunk.deleteMany({ where: { classId } }),
    db.lecture.deleteMany({ where: { classId } }),
    db.class.delete({ where: { id: classId } }),
  ]);

  return NextResponse.json({ ok: true });
}
