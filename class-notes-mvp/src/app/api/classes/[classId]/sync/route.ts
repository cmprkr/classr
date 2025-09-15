// src/app/api/classes/[classId]/sync/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ classId: string }> }) {
  const { classId } = await ctx.params;
  const user = await requireUser();
  const { syncKey } = (await req.json()) as { syncKey?: string };

  if (!syncKey) return NextResponse.json({ error: "syncKey required" }, { status: 400 });

  const clazz = await db.class.findFirst({ where: { id: classId, userId: user.id } });
  if (!clazz) return NextResponse.json({ error: "class not found" }, { status: 404 });

  // Set the syncKey on all existing lectures in this class
  await db.lecture.updateMany({
    where: { classId },
    data: { syncKey },
  });

  return NextResponse.json({ ok: true });
}
