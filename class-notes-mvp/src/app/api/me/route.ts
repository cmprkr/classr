// src/app/api/me/route.ts
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import fsp from "fs/promises";

const s3 = new S3Client({ region: process.env.S3_REGION! });
async function s3DeleteSafe(key?: string | null) {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key
    }));
  } catch {}
}

async function unlinkSafe(path: string | null | undefined) {
  if (!path) return;
  try {
    await fsp.unlink(path);
  } catch {
    // ignore
  }
}

// NEW: fetch minimal profile + defaultUniversityDomain
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const u = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      image: true,
      defaultUniversityDomain: true,
    },
  });
  return NextResponse.json(u);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const rawName = typeof body?.name === "string" ? body.name : undefined;
  const rawDomain =
    "defaultUniversityDomain" in body ? (body.defaultUniversityDomain ?? null) : undefined;

  const data: Record<string, any> = {};
  if (rawName !== undefined) data.name = rawName.toString().trim() || null;
  if (rawDomain !== undefined) {
    const v =
      rawDomain === null || rawDomain === ""
        ? null
        : String(rawDomain).trim().toLowerCase();
    data.defaultUniversityDomain = v;
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id as string },
    data,
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

  if (process.env.NODE_ENV === "production") {
    await Promise.allSettled(filePaths.map((k) => s3DeleteSafe(k)));
  } else {
    await Promise.allSettled(filePaths.map((p) => unlinkSafe(p)));
  }

  await db.$transaction(async (tx) => {
    if (classIds.length) {
      await tx.chunk.deleteMany({ where: { classId: { in: classIds } } });
      await tx.lecture.deleteMany({ where: { classId: { in: classIds } } });
      await tx.class.deleteMany({ where: { id: { in: classIds } } });
    }
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  revalidatePath("/account");
  revalidatePath("/");

  return NextResponse.json({ ok: true });
}
