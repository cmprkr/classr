// app/api/classes/[classId]/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openai, MODELS } from "@/lib/openai";
import { uploadsPath } from "@/lib/paths";
import { chunkTranscript } from "@/lib/chunking";
import fs from "fs";                // ← Node fs (streams)
import fsp from "fs/promises";      // ← fs promises
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ classId: string }> }
) {
  const { classId } = await ctx.params; // ✅ await params
  const clazz = await db.class.findUnique({ where: { id: classId } });
  if (!clazz) return NextResponse.json({ error: "class not found" }, { status: 404 });

  await fsp.mkdir(uploadsPath(), { recursive: true });

  const form = await req.formData();
  const files = form.getAll("file") as File[];
  if (!files.length) return NextResponse.json({ error: "no files" }, { status: 400 });

  const results: any[] = [];

  for (const f of files) {
    const arrBuf = await f.arrayBuffer();
    const buf = Buffer.from(arrBuf);
    const filenameSafe = f.name?.replace(/[^\w.\-]+/g, "_") || `upload_${Date.now()}.mp3`;
    const dest = uploadsPath(`${Date.now()}_${filenameSafe}`);

    await fsp.writeFile(dest, buf);

    const lec = await db.lecture.create({
      data: {
        classId,
        originalName: f.name || path.basename(dest),
        filePath: dest,
        status: "PROCESSING",
      },
    });

    try {
      // ✅ Use a Node read stream for OpenAI transcription
      const fileStream = fs.createReadStream(dest);
      const tr: any = await openai.audio.transcriptions.create({
        model: MODELS.stt, // "whisper-1"
        file: fileStream,
        response_format: "verbose_json",
      });

      const segments = (tr.segments || []).map((s: any) => ({
        start: Math.floor(s.start),
        end: Math.ceil(s.end),
        text: s.text,
      }));

      const transcriptText =
        tr.text || segments.map((s: any) => s.text).join(" ");

      const chunks = chunkTranscript(segments);

      const embeddings = await openai.embeddings.create({
        model: MODELS.embed,
        input: chunks.map((c) => c.text),
      });

      await db.$transaction(async (tx) => {
        await tx.lecture.update({
          where: { id: lec.id },
          data: {
            durationSec: Math.ceil(tr.duration ?? (segments.at(-1)?.end ?? 0)),
            transcript: transcriptText,
            segmentsJson: JSON.stringify(segments),
          },
        });

        for (let i = 0; i < chunks.length; i++) {
          await tx.chunk.create({
            data: {
              classId,
              lectureId: lec.id,
              source: "transcript",
              startSec: chunks[i].start,
              endSec: chunks[i].end,
              text: chunks[i].text,
              vectorJson: JSON.stringify(embeddings.data[i].embedding),
            },
          });
        }
      });

      const summary = await openai.chat.completions.create({
        model: MODELS.chat,
        messages: [
          { role: "system", content: "You are a concise study-note generator for a university class." },
          {
            role: "user",
            content:
              `Create: (1) 6-8 bullet summary, (2) 6 key terms & defs, (3) 8 flashcards JSON. Transcript:\n\n` +
              transcriptText.slice(0, 12000),
          },
        ],
      });

      await db.lecture.update({
        where: { id: lec.id },
        data: { status: "READY", summaryJson: summary.choices[0].message.content ?? "" },
      });

      results.push({ lectureId: lec.id, status: "READY" });
    } catch (e: any) {
      console.error("Transcription or processing failed:", e?.message || e);
      await db.lecture.update({ where: { id: lec.id }, data: { status: "FAILED" } });
      results.push({ lectureId: lec.id, status: "FAILED", error: e?.message || String(e) });
    }
  }

  return NextResponse.json({ ok: true, results });
}
