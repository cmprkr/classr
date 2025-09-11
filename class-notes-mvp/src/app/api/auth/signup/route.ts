import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  const { name, email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const lower = String(email).toLowerCase();
  const exists = await db.user.findUnique({ where: { email: lower } });
  if (exists) return NextResponse.json({ error: "Email already in use" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({ data: { name, email: lower, passwordHash } });

  return NextResponse.json({ ok: true });
}
