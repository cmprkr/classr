// src/app/api/lectures/[lectureId]/resummarize/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { openai, MODELS } from "@/lib/openai";
import { buildSummaryMessages } from "@/lib/prompts/summary";
import { generateKeyTerms } from "@/lib/prompts/keyterms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ lectureId: string }> }
) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();

  const lecture = await db.lecture.findFirst({
    where: { id: lectureId, userId: user.id },
    select: {
      id: true,
      transcript: true,
      textContent: true,
      descriptor: true,
      originalName: true,
    },
  });

  if (!lecture) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const basisRaw = (lecture.transcript || "") + (lecture.textContent ? `\n\n${lecture.textContent}` : "");
  const basis = basisRaw.slice(0, 12000);

  const resp = await openai.chat.completions.create({
    model: MODELS.chat,
    temperature: 0.1,
    messages: [...buildSummaryMessages({
      basis,
      includeSourceNotes: true, // this route had the extended section
    })],
  });
  const summaryJson = resp.choices[0].message.content ?? "";

  let keyTerms: string[] = [];
  try { if (basis) keyTerms = await generateKeyTerms(basis); } catch (e) {
    console.error("keyterms(resummarize):", (e as any)?.message || e);
  }

  await db.lecture.update({
    where: { id: lecture.id },
    data: { summaryJson, keyTermsJson: keyTerms },
  });

  return NextResponse.json({ summaryJson });
}
