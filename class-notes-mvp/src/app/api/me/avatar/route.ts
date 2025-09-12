// app/api/me/avatar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const blob = file as File;
  const bytes = Buffer.from(await blob.arrayBuffer());

  const publicDir = path.join(process.cwd(), "public");
  const avatarDir = path.join(publicDir, "avatars");
  await mkdir(avatarDir, { recursive: true });

  const ext = blob.type?.includes("png")
    ? ".png"
    : blob.type?.includes("webp")
    ? ".webp"
    : ".jpg";

  const filename = `${session.user.id}${ext}`;
  const filepath = path.join(avatarDir, filename);

  await writeFile(filepath, bytes);

  const imageUrl = `/avatars/${filename}?ts=${Date.now()}`; // cache-bust

  await db.user.update({
    where: { id: session.user.id as string },
    data: { image: imageUrl },
  });

  // Ensure fresh SSR on account + any place the sidebar renders
  revalidatePath("/account");
  revalidatePath("/");

  return NextResponse.json({ imageUrl });
}
