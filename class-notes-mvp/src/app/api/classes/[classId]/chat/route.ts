// src/app/api/classes/[classId]/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { openai, MODELS } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cit = {
  lectureId: string;
  source: string;
  startSec?: number | null;
  endSec?: number | null;
  text: string;
  score: number;
  originalName?: string;
};

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function toPreview(text: string, max = 280) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

async function backfillVectors(classId: string, maxToEmbed = 200) {
  // `vectorJson` is a string column; treat empty string as "missing"
  const missing = await db.chunk.findMany({
    where: { classId, vectorJson: "" },
    orderBy: { createdAt: "desc" },
    take: maxToEmbed,
    select: { id: true, text: true },
  });

  const inputs = missing.map(m => (m.text || "").trim()).filter(Boolean);
  if (missing.length === 0 || inputs.length === 0) return 0;

  const emb = await openai.embeddings.create({ model: MODELS.embed, input: inputs });

  let idx = 0;
  for (let i = 0; i < missing.length; i++) {
    if (!missing[i].text || !missing[i].text.trim()) continue;
    await db.chunk.update({
      where: { id: missing[i].id },
      data: { vectorJson: JSON.stringify((emb.data[idx++] as any).embedding) },
    });
  }
  return idx;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ classId: string }> }) {
  try {
    const { classId } = await ctx.params;
    const user = await requireUser();
    const { message } = await req.json();

    const query = (message ?? "").trim();
    if (!query) return NextResponse.json({ error: "Message required" }, { status: 400 });

    // Ownership guard
    const clazz = await db.class.findFirst({
      where: { id: classId, userId: user.id },
      select: { id: true, name: true },
    });
    if (!clazz) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    // Persist user message
    await db.chatMessage.create({ data: { classId, userId: user.id, role: "user", content: query } });

    // Embed query
    const qEmbRes = await openai.embeddings.create({ model: MODELS.embed, input: query });
    const qVec = qEmbRes.data[0].embedding as number[];

    // Ensure vectors exist for recent chunks (lazy backfill)
    await backfillVectors(classId, 300);

    // Pull chunks — ONLY from lectures included in memory
    const chunks = await db.chunk.findMany({
      where: {
        classId,
        lecture: { is: { includeInMemory: true } }, // relation filter
      },
      orderBy: { createdAt: "desc" },
      take: 4000,
      include: {
        lecture: { select: { originalName: true } }, // expose `lecture` for display
      },
    });

    // Score
    const scored: Cit[] = [];
    for (const c of chunks) {
      if (!c.vectorJson) continue; // empty string = not embedded yet
      let v: number[] | null = null;
      try { v = JSON.parse(c.vectorJson as any); } catch {}
      if (!v) continue;
      const score = cosine(qVec, v);
      if (score > 0) {
        scored.push({
          lectureId: c.lectureId,
          source: c.source,
          startSec: c.startSec,
          endSec: c.endSec,
          text: c.text,
          score,
          originalName: c.lecture?.originalName ?? undefined,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const topK = scored.slice(0, 12);

    // Class chat history window (last ~12 turns)
    const history = await db.chatMessage.findMany({
      where: { classId, userId: user.id },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { role: true, content: true },
    });

    const contextBlocks = topK.map((c, i) =>
      `[#${i + 1} | ${c.source}${c.originalName ? ` • ${c.originalName}` : ""}${c.startSec!=null?` • ${c.startSec}-${c.endSec}s`:""} | score=${c.score.toFixed(3)}]\n${c.text}`
    ).join("\n\n");

    const historyBlocks = history.slice(-12)
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const system =
      `You are a helpful TA for the course "${clazz.name}". ` +
      `Use only the provided class materials and the recent chat history. ` +
      `If an answer isn’t in the materials, say you don’t know. ` +
      `Cite snippets using [#index] corresponding to the context items. Be concise and precise.`;

    const userPrompt =
`Class context:
${contextBlocks || "(no relevant snippets found)"}

Recent chat (this class):
${historyBlocks || "(no recent messages yet)"}

Question:
${query}
`;

    const completion = await openai.chat.completions.create({
      model: MODELS.chat,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
    });

    const answer = completion.choices[0].message.content ?? "Sorry, I couldn’t generate a response.";
    const citations = topK.map((c, idx) => ({
      idx: idx + 1,
      lectureId: c.lectureId,
      source: c.source,
      span: c.startSec != null ? { startSec: c.startSec, endSec: c.endSec } : undefined,
      preview: toPreview(c.text),
      originalName: c.originalName,
      score: c.score,
    }));

    await db.chatMessage.create({
      data: { classId, userId: user.id, role: "assistant", content: answer, citations: JSON.stringify(citations) },
    });

    return NextResponse.json({ answer, citations });
  } catch (e: any) {
    console.error("chat route error:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}
