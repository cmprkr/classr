// app/api/classes/[classId]/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openai, MODELS } from "@/lib/openai";
import { cosine } from "@/lib/chunking";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ classId: string }> }
) {
  const { classId } = await ctx.params;             // ✅ await
  const { message } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "message required" }, { status: 400 });

  const clazz = await db.class.findUnique({ where: { id: classId }});
  if (!clazz) return NextResponse.json({ error: "class not found" }, { status: 404 });

  const q = await openai.embeddings.create({ model: MODELS.embed, input: message });
  const qv = q.data[0].embedding;

  const chunks = await db.chunk.findMany({ where: { classId }, take: 500, orderBy: { createdAt: "desc" }});
  const top = chunks
    .map((ch) => ({ ch, score: cosine(qv, JSON.parse(ch.vectorJson) as number[]) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const context = top.map(({ ch }) => `[${ch.id}] (${ch.lectureId} @ ${ch.startSec}-${ch.endSec}s)\n${ch.text}`).join("\n\n");

  await db.chatMessage.create({ data: { classId, role: "user", content: message } });

  const sys = `You are a tutor for this class. ONLY use the provided CONTEXT. If the answer is not in context, say you don't know. Cite chunk IDs like [chunkId]. Be concise.`;
  const prompt = `QUESTION:\n${message}\n\nCONTEXT:\n${context}`;

  const resp = await openai.chat.completions.create({
    model: MODELS.chat,
    messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
  });

  const answer = resp.choices[0].message.content || "…";
  const citations = top.map(({ ch }) => ({ lectureId: ch.lectureId, chunkId: ch.id, startSec: ch.startSec, endSec: ch.endSec }));

  await db.chatMessage.create({
    data: { classId, role: "assistant", content: answer, citations: JSON.stringify(citations) },
  });

  return NextResponse.json({ answer, citations });
}
