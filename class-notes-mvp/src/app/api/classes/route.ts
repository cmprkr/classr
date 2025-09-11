// app/api/classes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const classes = await db.class.findMany({ orderBy: { createdAt: "desc" }});
  return NextResponse.json(classes);
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const c = await db.class.create({ data: { name } });
  return NextResponse.json(c);
}
