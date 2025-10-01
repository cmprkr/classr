// src/app/api/classes/[classId]/record/finalize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { openai, MODELS } from "@/lib/openai";
import { chunkTranscript } from "@/lib/chunking";
import { buildSummaryMessages } from "@/lib/prompts/summary";
import { getUsedMinutesThisWeek, addMinutesThisWeek, FREE_WEEKLY_MIN } from "@/lib/billing";
import { generateKeyTerms } from "@/lib/prompts/keyterms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Part = {
  chunkIndex: number;
  text: string;
  duration: number; // seconds
  segments: { start: number; end: number; text: string }[]; // local to chunk
};

async function safeEmbed(texts: string[]) {
  const inputs = texts.map((t) => (t ?? "").trim()).filter(Boolean);
  if (inputs.length === 0) return null;
  return await openai.embeddings.create({ model: MODELS.embed, input: inputs });
}

export async function POST(
  req: NextRequest,
  ctx: { params: { classId: string } }
) {
  const user = await requireUser();
  const { classId } = ctx.params;

  // Body contains stitched metadata from client
  const body = await req.json().catch(() => null as any);
  const parts: Part[] = Array.isArray(body?.parts) ? body.parts : [];
  const descriptor: string | undefined = body?.descriptor || undefined;
  const filename: string = body?.filename || `recording_${Date.now()}.webm`;

  if (!parts.length) {
    return NextResponse.json({ error: "no parts" }, { status: 400 });
  }

  // Sort by chunkIndex just in case
  parts.sort((a, b) => a.chunkIndex - b.chunkIndex);

  // Enforce free limit based on *actual* duration
  const totalSec = parts.reduce((s, p) => s + Math.max(0, Math.floor(p.duration || 0)), 0);
  const totalMinutes = Math.max(1, Math.ceil(totalSec / 60));

  const u = await db.user.findUnique({
    where: { id: user.id },
    select: { planTier: true, planStatus: true },
  });
  const premium = u?.planTier === "PREMIUM" && u?.planStatus === "active";
  if (!premium) {
    const { minutes } = await getUsedMinutesThisWeek(user.id);
    if (minutes + totalMinutes > FREE_WEEKLY_MIN) {
      return NextResponse.json(
        { error: "limit_reached", detail: `Weekly audio limit: ${minutes}/${FREE_WEEKLY_MIN} used.` },
        { status: 402 }
      );
    }
  }

  // Build global transcript + segments (offset each chunk)
  let offset = 0;
  let transcriptText = "";
  const globalSegments: { start: number; end: number; text: string }[] = [];

  for (const p of parts) {
    // Normalize duration fence
    const dur = Math.max(0, Math.floor(p.duration || 0));
    transcriptText += (transcriptText ? " " : "") + (p.text || "").trim();

    for (const s of p.segments || []) {
      const start = Math.max(0, Math.floor((s.start || 0) + offset));
      const end = Math.max(start, Math.floor((s.end || 0) + offset));
      const text = String(s.text || "").trim();
      if (text) globalSegments.push({ start, end, text });
    }
    offset += dur;
  }

  // Create Lecture row (no original file path here; this is recorder mode)
  const lec = await db.lecture.create({
    data: {
      classId,
      userId: user.id,
      originalName: filename,
      mime: "audio/webm",
      descriptor,
      kind: "LECTURE",
      status: "PROCESSING",
      transcript: transcriptText,
      durationSec: totalSec,
      segmentsJson: JSON.stringify(globalSegments),
    },
    select: { id: true },
  });

  // Create chunks from segments and embed
  const chunks = chunkTranscript(globalSegments);
  for (const c of chunks) {
    await db.chunk.create({
      data: {
        classId,
        lectureId: lec.id,
        source: "transcript",
        startSec: c.start,
        endSec: c.end,
        text: c.text,
        vectorJson: "",
      },
    });
  }

  try {
    const emb = await safeEmbed(chunks.map((c) => c.text));
    if (emb) {
      for (let i = 0; i < chunks.length; i++) {
        await db.chunk.updateMany({
          where: {
            lectureId: lec.id,
            source: "transcript",
            startSec: chunks[i].start,
            endSec: chunks[i].end,
            vectorJson: "",
          },
          data: { vectorJson: JSON.stringify(emb.data[i].embedding) },
        });
      }
    }
  } catch (e: any) {
    console.error("recorder finalize: embedding failed:", e?.message || e);
  }

  // Generate summary (same structure you already use)
  let summaryContent = "";

  const basis = transcriptText.slice(0, 12000);
  if (basis) {
    const sum = await openai.chat.completions.create({
      model: MODELS.chat,
      temperature: 0.1,
      messages: [...buildSummaryMessages({
        basis,
        includeSourceNotes: false, // this route previously didn’t include the section
      })],
    });
    summaryContent = sum.choices[0].message.content ?? "";
  }

  let keyTerms: string[] = [];
  try {
    const basis = transcriptText.slice(0, 12000);
    if (basis) keyTerms = await generateKeyTerms(basis);
  } catch (e) {
    console.error("keyterms(record/finalize):", (e as any)?.message || e);
  }

  await db.lecture.update({
    where: { id: lec.id },
    data: { status: "READY", summaryJson: summaryContent, keyTermsJson: keyTerms },
  });

  // Track usage for ALL plans
  await addMinutesThisWeek(user.id, Math.max(1, Math.ceil(totalSec / 60)));

  return NextResponse.json({ ok: true, lectureId: lec.id, durationSec: totalSec });
}
