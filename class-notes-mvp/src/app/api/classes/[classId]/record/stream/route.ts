// src/app/api/classes/[classId]/record/stream/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { openai, MODELS } from "@/lib/openai";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function transcribeChunk(filePath: string) {
  const fileStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 * 4 });
  const tr: any = await openai.audio.transcriptions.create({
    model: MODELS.stt,
    file: fileStream as any,
    response_format: "verbose_json",
  });
  const segments = (tr.segments || []).map((s: any) => ({
    start: Math.floor(s.start),
    end: Math.ceil(s.end),
    text: s.text,
  }));
  const text = tr.text || segments.map((s: any) => s.text).join(" ");
  const duration = Math.ceil(tr.duration ?? (segments.at(-1)?.end ?? 0));
  return { text, segments, duration };
}

export async function POST(
  req: NextRequest,
  ctx: { params: { classId: string } }
) {
  await requireUser(); // auth—no DB writes here
  const form = await req.formData();

  // Required fields from client
  const recordingId = String(form.get("recordingId") || "");
  const chunkIndex = Number(form.get("chunkIndex") || "0");

  const file = form.get("file") as File | null;
  if (!recordingId || !file) {
    return NextResponse.json({ error: "missing recordingId or file" }, { status: 400 });
  }

  // Persist temp file, transcribe, delete
  const tmpRoot = process.env.NODE_ENV === "production" ? "/tmp/uploads" : ".next/tmp";
  await fsp.mkdir(tmpRoot, { recursive: true });
  const safeName = `rec_${recordingId}_chunk_${chunkIndex}_${Date.now()}.webm`;
  const tempPath = path.join(tmpRoot, safeName);

  await fsp.writeFile(tempPath, Buffer.from(await file.arrayBuffer()));
  try {
    const result = await transcribeChunk(tempPath);
    return NextResponse.json({
      ok: true,
      recordingId,
      chunkIndex,
      text: result.text,
      duration: result.duration,
      segments: result.segments, // segment times are local to this chunk
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "transcribe_failed", detail: e?.message || String(e) },
      { status: 500 }
    );
  } finally {
    try { await fsp.unlink(tempPath); } catch {}
  }
}
