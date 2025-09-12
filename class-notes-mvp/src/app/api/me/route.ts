// app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

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

  // Revalidate account (profile card) and any pages that render the sidebar
  revalidatePath("/account");
  revalidatePath("/");

  return NextResponse.json({ ok: true });
}
