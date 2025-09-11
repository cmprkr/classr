// lib/auth.ts
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
  return session.user as { id: string; name?: string | null; email?: string | null };
}

// New: non-throwing helper
export async function maybeUser() {
  const session = await getServerSession(authOptions);
  return session?.user?.id
    ? (session.user as { id: string; name?: string | null; email?: string | null })
    : null;
}

// New: convenience for API routes
export function json401() {
  return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
}
