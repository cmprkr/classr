// lib/auth.ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

/** Return the signed-in user or null (stale sessions resolve to null). */
export async function maybeUser() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id as string | undefined;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, image: true },
  });
  return user ?? null;
}

/** Return the signed-in user or throw {status:401} if not signed in / stale. */
export async function requireUser() {
  const user = await maybeUser();
  if (!user) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return user;
}

/** Convenience helper for routes that want to early-return a 401 JSON. */
export function json401(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}
