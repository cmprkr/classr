// app/api/classes/[classId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ classId: string }> }
) {
  const { classId } = await ctx.params;             // ✅ await
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
