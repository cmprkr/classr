// app/api/classes/[classId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import fsp from "fs/promises";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ classId: string }> }
) {
  const { classId } = await ctx.params;
  const c = await db.class.findUnique({
    where: { id: classId },
    include: {
      lectures: { orderBy: { createdAt: "desc" } },
      chats: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(c);
}

// DELETE a class and all associated records + local audio files
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ classId: string }> }
) {
  const { classId } = await ctx.params;

  const klass = await db.class.findUnique({
    where: { id: classId },
    include: { lectures: true },
  });
  if (!klass) return NextResponse.json({ ok: true }); // idempotent

  // Best effort: remove local audio files
  await Promise.allSettled(
    (klass.lectures || []).map((l) =>
      l.filePath ? fsp.unlink(l.filePath).catch(() => {}) : Promise.resolve()
    )
  );

  // Delete in DB (order matters because of FKs)
  await db.$transaction([
    db.chunk.deleteMany({ where: { classId } }),
    db.chatMessage.deleteMany({ where: { classId } }),
    db.lecture.deleteMany({ where: { classId } }),
    db.class.delete({ where: { id: classId } }),
  ]);

  return NextResponse.json({ ok: true });
}
