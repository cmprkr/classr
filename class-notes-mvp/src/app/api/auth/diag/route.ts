import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs"; // ensure Node runtime

export async function GET() {
  const must = [
    "NEXTAUTH_URL","NEXTAUTH_SECRET",
    "DATABASE_URL",           // if using Prisma
    "OPENAI_API_KEY"          // if you call OpenAI on SSR
    // add GOOGLE_CLIENT_ID/SECRET if you use Google
  ];
  const missing = must.filter(k => !process.env[k]);

  try {
    // DB ping (comment out if no DB)
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1 as ok`;
    return NextResponse.json({ ok: true, missing });
  } catch (e: any) {
    return new NextResponse(
      JSON.stringify({ ok: false, missing, error: e?.message, stack: e?.stack }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
