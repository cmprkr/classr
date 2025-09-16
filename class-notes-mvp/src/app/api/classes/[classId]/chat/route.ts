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

// Optional; keep if you use it elsewhere
async function backfillVectors(classId: string, maxToEmbed = 200) {
  const missing = await db.chunk.findMany({
    where: {
      classId,
      OR: [{ vectorJson: "" }],
    },
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

    const clazz = await db.class.findFirst({
      where: { id: classId, userId: user.id },
      select: { id: true, name: true, syncKey: true },
    });
    if (!clazz) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    await db.chatMessage.create({ data: { classId, userId: user.id, role: "user", content: query } });

    const qEmbRes = await openai.embeddings.create({ model: MODELS.embed, input: query });
    const qVec = qEmbRes.data[0].embedding as number[];

    await backfillVectors(classId, 300);

    // 1) Find lectures this user can see (owned or shared via syncKey)
    const viewerClasses = await db.class.findMany({
      where: { userId: user.id },
      select: { id: true, syncKey: true },
    });
    const viewerClassIds = viewerClasses.map(c => c.id);
    const viewerSyncKeys = viewerClasses.map(c => c.syncKey).filter((k): k is string => !!k);

    const accessibleLectures = await db.lecture.findMany({
      where: {
        OR: [
          { classId: { in: viewerClassIds } },
          { syncKey: { in: viewerSyncKeys } },
        ],
      },
      select: { id: true, includeInMemory: true },
    });

    if (accessibleLectures.length === 0) {
      const fallback = "I don’t have any class materials I’m allowed to use for that yet.";
      await db.chatMessage.create({
        data: { classId, userId: user.id, role: "assistant", content: fallback, citations: "[]" },
      });
      return NextResponse.json({ answer: fallback, citations: [] });
    }

    // 2) Pull this viewer's prefs for those lectures
    const prefs = await db.lectureUserPref.findMany({
      where: { userId: user.id, lectureId: { in: accessibleLectures.map(l => l.id) } },
      select: { lectureId: true, includeInAISummary: true },
    });
    const prefMap = new Map(prefs.map(p => [p.lectureId, p.includeInAISummary]));

    // 3) Compute allowed lecture IDs for THIS viewer
    const allowedLectureIds = new Set<string>();
    for (const lec of accessibleLectures) {
      const override = prefMap.get(lec.id);
      if (override === true) allowedLectureIds.add(lec.id);
      else if (override === false) { /* excluded by viewer */ }
      else if (lec.includeInMemory) allowedLectureIds.add(lec.id); // fallback to legacy
    }

    if (allowedLectureIds.size === 0) {
      const fallback =
        "I don’t have any class materials I’m allowed to use for that yet. " +
        "This can happen if items are excluded from AI memory for your account.";
      await db.chatMessage.create({
        data: { classId, userId: user.id, role: "assistant", content: fallback, citations: "[]" },
      });
      return NextResponse.json({ answer: fallback, citations: [] });
    }

    // 4) Retrieve only chunks from allowed lectures
    const chunks = await db.chunk.findMany({
      where: { lectureId: { in: Array.from(allowedLectureIds) } },
      orderBy: { createdAt: "desc" },
      take: 4000,
      include: { lecture: { select: { originalName: true } } },
    });

    // 5) Score & select
    const scored: Cit[] = [];
    for (const c of chunks) {
      if (!c.vectorJson) continue;
      let v: number[] | null = null;
      try { v = JSON.parse(c.vectorJson as any); } catch {}
      if (!v) continue;
      const score = cosine(qVec, v);
      if (score > 0.18) {
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

    // 6) Strict RAG: if nothing to cite, no LLM call
    if (topK.length === 0) {
      const fallback =
        "I don’t know based on the provided class materials I’m allowed to use. " +
        "Try including relevant items in AI memory, then ask again.";
      await db.chatMessage.create({
        data: { classId, userId: user.id, role: "assistant", content: fallback, citations: "[]" },
      });
      return NextResponse.json({ answer: fallback, citations: [] });
    }

    const contextBlocks = topK.map((c, i) =>
      `[#${i + 1} | ${c.source}${c.originalName ? ` • ${c.originalName}` : ""}${c.startSec!=null?` • ${c.startSec}-${c.endSec}s`:""} | score=${c.score.toFixed(3)}]\n${c.text}`
    ).join("\n\n");

    const history = await db.chatMessage.findMany({
      where: { classId, userId: user.id },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { role: true, content: true },
    });
    const historyBlocks = history.slice(-12)
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const system =
      `You are a helpful TA for the course "${clazz.name}". ` +
      `Use ONLY the provided class materials (context items). ` +
      `If the answer is not in the materials, reply exactly: "I don't know based on the provided class materials." ` +
      `Cite with [#index]. Be concise.`;

    const userPrompt =
`Class context:
${contextBlocks}

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

    const answer = completion.choices[0].message.content ?? "I don't know based on the provided class materials.";
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
