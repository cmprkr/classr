// app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import fsp from "fs/promises";

async function unlinkSafe(path: string | null | undefined) {
  if (!path) return;
  try {
    await fsp.unlink(path);
  } catch {
    // ignore
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const name = (body?.name ?? "").toString().trim();

  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id as string },
    data: { name },
  });

  revalidatePath("/account");
  revalidatePath("/");

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // gather classes + file paths
  const classes = await db.class.findMany({
    where: { userId },
    select: { id: true, lectures: { select: { filePath: true } } },
  });

  const classIds = classes.map((c) => c.id);
  const filePaths = classes.flatMap((c) => c.lectures.map((l) => l.filePath).filter(Boolean));

  await Promise.allSettled(filePaths.map((p) => unlinkSafe(p)));

  await db.$transaction(async (tx) => {
    if (classIds.length) {
      await tx.chunk.deleteMany({ where: { classId: { in: classIds } } });
      await tx.lecture.deleteMany({ where: { classId: { in: classIds } } });
      await tx.class.deleteMany({ where: { id: { in: classIds } } });
    }
    // if using NextAuth Prisma adapter
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  revalidatePath("/account");
  revalidatePath("/");

  return NextResponse.json({ ok: true });
}
