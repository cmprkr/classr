// src/app/api/classes/[classId]/record/finalize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { openai, MODELS } from "@/lib/openai";
import { chunkTranscript } from "@/lib/chunking";
import { getUsedMinutesThisWeek, addMinutesThisWeek, FREE_WEEKLY_MIN } from "@/lib/billing";

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
      messages: [
        {
          role: "system",
          content: [
            "You are a rigorous, non-hallucinating note composer for college STEM courses.",
            "Your job: produce a highly structured, detailed Markdown summary that is consistent across inputs and faithful to the source.",
            "Rules:",
            "1) Do NOT invent facts. If something is not present in the source, write “Not stated in source.”",
            "2) Prefer equations, units, and constraints exactly as given.",
            "3) Use the required headings verbatim and in the exact order.",
            "4) Keep wording concise, but do not omit core steps, definitions, or assumptions.",
            "5) If the input is long, first infer a clean outline of sections/topics, then aggregate into the required format.",
            "6) Use tables where indicated; never change column names.",
            "7) If no explicit homework is provided, generate 5 practice problems strictly grounded in the presented material (no outside facts). Provide brief answers at the end.",
            "8) If symbols or variables appear, define them once in Key Terms and refer back consistently.",
            "9) If a formula depends on conditions, list them under “Constraints/Conditions”.",
            "10) If examples are present in the source, preserve their numbers/values; if not, create 1–2 short worked examples using only source formulas/definitions.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "Create a comprehensive, structured Markdown document titled with the inferred topic, exactly in this format:",
            "",
            "# {{Inferred Topic}} Summary",
            "",
            "## TL;DR",
            "- 5–8 bullets capturing the most important takeaways and results.",
            "",
            "## Key Terms & Symbols",
            "| Term/Symbol | Definition (from source) | Units | Notes |",
            "|---|---|---|---|",
            "- Include every symbol or specialized term that appears. If none: “Not stated in source.”",
            "",
            "## Main Ideas (Numbered)",
            "1. Core idea 1 — 1–3 sentence explanation.",
            "2. Core idea 2 — 1–3 sentence explanation.",
            "3. Core idea 3 — etc.",
            "",
            "## Core Formulas",
            "| Formula | Meaning | Variables Defined | Units | Constraints/Conditions |",
            "|---|---|---|---|---|",
            "- Show formulas exactly (use inline math like `x = vt` if LaTeX unavailable).",
            "",
            "## Procedures / Derivations (Step-by-Step)",
            "- Break multi-step derivations or procedures into numbered steps.",
            "- State assumptions at the top of each procedure.",
            "",
            "## Worked Examples",
            "- **Example 1**",
            "  - *Given:* …",
            "  - *Find:* …",
            "  - *Solution (steps):* …",
            "  - *Answer:* …",
            "- **Example 2** (if source lacks examples, craft one consistent with the text)",
            "",
            "## Edge Cases & Common Pitfalls",
            "- List tricky cases, boundary conditions, sign conventions, unit mix-ups, typical mistakes.",
            "",
            "## Connections & Prerequisites",
            "- Briefly note prior concepts needed and how this topic links to others in the course.",
            "",
            "## Homework / Practice",
            "- If the source lists homework: reproduce it faithfully.",
            "- Otherwise: provide 5 original practice problems derived strictly from the content above (no outside facts).",
            "",
            "## Answers (Brief)",
            "- Short answers or final numeric results for the practice problems (no full solutions).",
            "",
            "LECTURE TEXT (first ~12k chars follows):",
            basis,
          ].join("\n"),
        },
      ],
    });
    summaryContent = sum.choices[0].message.content ?? "";
  }

  await db.lecture.update({
    where: { id: lec.id },
    data: {
      status: "READY",
      summaryJson: summaryContent,
    },
  });

  // Track usage for ALL plans
  await addMinutesThisWeek(user.id, Math.max(1, Math.ceil(totalSec / 60)));

  return NextResponse.json({ ok: true, lectureId: lec.id, durationSec: totalSec });
}
