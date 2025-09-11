// app/api/classes/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { maybeUser, requireUser, json401 } from "@/lib/auth";

export async function GET() {
  const user = await maybeUser();
  if (!user) {
    // Not signed in? Return an empty list so UI can still render.
    return NextResponse.json([]);
  }
  const classes = await db.class.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(classes);
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(); // must be signed in to create
    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const c = await db.class.create({ data: { name: name.trim(), userId: user.id } });
    return NextResponse.json(c, { status: 201 });
  } catch {
    return json401();
  }
}
