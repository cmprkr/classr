// src/app/api/classes/[classId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { maybeUser, json401 } from "@/lib/auth";
import fsp from "fs/promises";

export async function GET(_req: Request, ctx: { params: Promise<{ classId: string }> }) {
  const user = await maybeUser();
  if (!user) return json401();
  const { classId } = await ctx.params;

  const c = await db.class.findFirst({
    where: { id: classId, userId: user.id },
    include: { lectures: { orderBy: { createdAt: "desc" } }, chats: { orderBy: { createdAt: "asc" } } },
  });
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ classId: string }> }) {
  const user = await maybeUser();
  if (!user) return json401();
  const { classId } = await ctx.params;
  const { name } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const existing = await db.class.findFirst({ where: { id: classId, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const updated = await db.class.update({ where: { id: classId }, data: { name: name.trim() } });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ classId: string }> }) {
  const user = await maybeUser();
  if (!user) return json401();
  const { classId } = await ctx.params;

  const klass = await db.class.findFirst({
    where: { id: classId, userId: user.id },
    include: { lectures: true },
  });
  if (!klass) return NextResponse.json({ ok: true });

  await Promise.allSettled(
    (klass.lectures || []).map((l) => (l.filePath ? fsp.unlink(l.filePath).catch(() => {}) : Promise.resolve()))
  );

  await db.$transaction([
    db.chunk.deleteMany({ where: { classId, clazz: { userId: user.id } } }),
    db.chatMessage.deleteMany({ where: { classId, userId: user.id } }),
    db.lecture.deleteMany({ where: { classId, clazz: { userId: user.id } } }),
    db.class.delete({ where: { id: classId } }),
  ]);

  return NextResponse.json({ ok: true });
}
