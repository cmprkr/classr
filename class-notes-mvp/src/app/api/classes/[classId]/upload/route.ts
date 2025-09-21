// API route: POST /api/classes/[classId]/upload

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { openai, MODELS } from "@/lib/openai";
import { uploadsPath } from "@/lib/paths";
import { chunkTranscript } from "@/lib/chunking";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { Readable } from "node:stream";
import { ResourceType } from "@prisma/client";

import ffmpeg from "fluent-ffmpeg";

// Use CJS require so we get absolute binary paths at runtime.
const ffmpegPath: string = require("ffmpeg-static");
const { path: ffprobePath }: { path: string } = require("@ffprobe-installer/ffprobe");

// Point fluent-ffmpeg at the real binaries (fallbacks allow system ffmpeg/ffprobe if installed)
ffmpeg.setFfmpegPath(ffmpegPath || "/usr/bin/ffmpeg");
ffmpeg.setFfprobePath(ffprobePath || "/usr/bin/ffprobe");


// NEW: S3 client (no static creds; Amplify compute role provides them in prod)
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- S3 configuration (set these in Amplify env) ---
const S3_BUCKET = process.env.S3_BUCKET!;
const S3_REGION = process.env.S3_REGION!;
const s3 = new S3Client({ region: S3_REGION });

// ---------- Helpers (unchanged logic) ----------
async function safeEmbed(texts: string[]) {
  const inputs = texts.map((t) => (t ?? "").trim()).filter(Boolean);
  if (inputs.length === 0) return null;
  return await openai.embeddings.create({ model: MODELS.embed, input: inputs });
}

async function guessKind(
  filename: string,
  mime: string | undefined,
  descriptor: string | undefined,
  sampleText: string
): Promise<ResourceType> {
  const prompt = `You are a classifier. Choose ONE label only from:
- LECTURE
- SLIDESHOW
- NOTES
- HANDOUT
- GRADED_ASSIGNMENT
- UNGRADED_ASSIGNMENT
- GRADED_TEST
- OTHER

Given:
- filename: ${filename}
- mime: ${mime || "unknown"}
- descriptor: ${descriptor || "none"}
- sampleText (first 2k chars):
${sampleText.slice(0, 2000)}

Respond with only the label.`;
  const r = await openai.chat.completions.create({
    model: MODELS.chat,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });
  const raw = (r.choices[0].message.content || "OTHER").trim().toUpperCase();
  const validTypes: ResourceType[] = [
    ResourceType.LECTURE,
    ResourceType.SLIDESHOW,
    ResourceType.NOTES,
    ResourceType.HANDOUT,
    ResourceType.GRADED_ASSIGNMENT,
    ResourceType.UNGRADED_ASSIGNMENT,
    ResourceType.GRADED_TEST,
    ResourceType.OTHER,
  ];
  const map: Record<string, ResourceType> = {
    LECTURE: ResourceType.LECTURE,
    SLIDESHOW: ResourceType.SLIDESHOW,
    NOTES: ResourceType.NOTES,
    HANDOUT: ResourceType.HANDOUT,
    GRADED_ASSIGNMENT: ResourceType.GRADED_ASSIGNMENT,
    "GRADED ASSIGNMENT": ResourceType.GRADED_ASSIGNMENT,
    UNGRADED_ASSIGNMENT: ResourceType.UNGRADED_ASSIGNMENT,
    "UNGRADED ASSIGNMENT": ResourceType.UNGRADED_ASSIGNMENT,
    GRADED_TEST: ResourceType.GRADED_TEST,
    "GRADED TEST": ResourceType.GRADED_TEST,
    OTHER: ResourceType.OTHER,
  };
  return map[raw] ?? ResourceType.OTHER;
}

async function ocrImageWithVision(filePath: string): Promise<string> {
  const bytes = await fsp.readFile(filePath);
  const ext = path.extname(filePath).replace(".", "") || "png";
  const b64 = `data:image/${ext};base64,${bytes.toString("base64")}`;
  const res = await openai.chat.completions.create({
    model: MODELS.vision,
    messages: [
      { role: "system", content: "Extract all legible text from the image. Return plain text only." },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Transcribe all text" },
          { type: "input_image", image_url: b64 },
        ] as any,
      },
    ],
    temperature: 0,
  });
  return res.choices[0].message.content ?? "";
}

async function readTxt(filePath: string) {
  return await fsp.readFile(filePath, "utf8");
}

async function readPdf(filePath: string) {
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  const data = await pdfParse(await fsp.readFile(filePath));
  return data.text || "";
}

async function readDocx(filePath: string) {
  const { default: mammoth } = await import("mammoth");
  const { value } = await mammoth.extractRawText({ path: filePath });
  return value || "";
}

const OPENAI_LIMIT = 24 * 1024 * 1024; // 24MB safety (API is ~25MB)

function getDurationSec(p: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(p, (err, data) => {
      if (err) return reject(err);
      resolve(Math.ceil((data.format?.duration as number) || 0));
    });
  });
}

async function transcodeToCompact(inputPath: string, outPath: string) {
  // 16 kHz mono, 48 kbps MP3 → very compact, speech-optimized
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec("libmp3lame")
      .audioChannels(1)
      .audioBitrate("48k")
      .outputOptions(["-ar 16000"])
      .on("error", reject)
      .on("end", () => resolve())
      .save(outPath);
  });
}

async function segmentAudio(inputPath: string, patternPath: string, secondsPerPart = 900) {
  // Split into ~15min parts; with 48 kbps each part is far below 25MB
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec("libmp3lame")
      .audioChannels(1)
      .audioBitrate("48k")
      .outputOptions(["-ar 16000", "-f segment", `-segment_time ${secondsPerPart}`, "-reset_timestamps 1"])
      .on("error", reject)
      .on("end", () => resolve())
      .save(patternPath); // e.g., /tmp/foo_part_%03d.mp3
  });
}

async function transcribeWithOpenAI(filePath: string) {
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

async function transcribeLargeAudio(filePath: string) {
  // 1) If already under limit, go straight to OpenAI
  const st = await fsp.stat(filePath);
  if (st.size <= OPENAI_LIMIT) {
    return await transcribeWithOpenAI(filePath);
  }

  // 2) Try compact transcode
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const compactPath = path.join(dir, `${base}_compact.mp3`);
  await transcodeToCompact(filePath, compactPath);

  const st2 = await fsp.stat(compactPath);
  if (st2.size <= OPENAI_LIMIT) {
    try {
      const r = await transcribeWithOpenAI(compactPath);
      try { await fsp.unlink(compactPath); } catch {}
      return r;
    } catch (e) {
      try { await fsp.unlink(compactPath); } catch {}
      throw e;
    }
  }

  // 3) Split into parts and transcribe sequentially
  const pattern = path.join(dir, `${base}_part_%03d.mp3`);
  await segmentAudio(compactPath, pattern, 900); // ~15 min
  // enumerate parts
  const files = (await fsp.readdir(dir))
    .filter((f) => f.startsWith(`${base}_part_`) && f.endsWith(".mp3"))
    .map((f) => path.join(dir, f))
    .sort();

  let totalText = "";
  let totalDuration = 0;
  let allSegments: { start: number; end: number; text: string }[] = [];

  for (const part of files) {
    const r = await transcribeWithOpenAI(part);
    // offset segments by elapsed duration
    const offset = totalDuration;
    const shifted = r.segments.map((s: { start: number; end: number; text: string }) => ({ start: s.start + offset, end: s.end + offset, text: s.text }));
    totalText += (totalText ? " " : "") + r.text;
    totalDuration += r.duration || (await getDurationSec(part));
    allSegments.push(...shifted);
    try { await fsp.unlink(part); } catch {}
  }

  try { await fsp.unlink(compactPath); } catch {}
  return { text: totalText, segments: allSegments, duration: totalDuration };
}

// ---------- Route handler ----------
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ classId: string }> }
) {
  const { classId } = await ctx.params;
  const user = await requireUser();

  const clazz = await db.class.findFirst({
    where: { id: classId, userId: user.id },
    select: { id: true, name: true, syncEnabled: true, syncKey: true },
  });
  if (!clazz) return NextResponse.json({ error: "class not found" }, { status: 404 });

  const effectiveSyncKey = clazz.syncEnabled ? (clazz.syncKey ?? null) : null;

  // Use /tmp in production (Amplify runtime). Keep local path in dev.
  const isProd = process.env.NODE_ENV === "production";
  const tmpRoot = isProd ? "/tmp/uploads" : uploadsPath();
  await fsp.mkdir(tmpRoot, { recursive: true });

  const form = await req.formData();
  const files = form.getAll("file") as File[];
  const descriptor = (form.get("descriptor") as string) || undefined;
  const manualText = (form.get("manualText") as string) || "";

  if (!files.length && !manualText.trim()) {
    return NextResponse.json({ error: "no files or manual text" }, { status: 400 });
  }

  const results: any[] = [];

  // --------- Manual text-only path (unchanged) ----------
  if (!files.length && manualText.trim()) {
    const lec = await db.lecture.create({
      data: {
        classId,
        userId: user.id,
        originalName: "Manual Text",
        descriptor,
        kind: ResourceType.NOTES,
        status: "READY",
        textContent: manualText.trim(),
        transcript: manualText.trim(),
        mime: "text/plain",
        syncKey: effectiveSyncKey,
      },
    });

    const segments = [
      { start: 0, end: Math.min(300, Math.ceil(manualText.length / 6)), text: manualText.slice(0, 12000) },
    ];
    const chunks = chunkTranscript(segments);

    for (const c of chunks) {
      await db.chunk.create({
        data: {
          classId,
          lectureId: lec.id,
          source: "notes",
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
              source: "notes",
              startSec: chunks[i].start,
              endSec: chunks[i].end,
              vectorJson: "",
            },
            data: { vectorJson: JSON.stringify(emb.data[i].embedding) },
          });
        }
      }
    } catch (e: any) {
      console.error("upload: notes embed failed:", e?.message || e);
    }

    results.push({ lectureId: lec.id, status: "READY" });
  }

  // --------- File uploads ----------
  for (const f of files) {
    // Size guard
    const MAX_BYTES = 1024 * 1024 * 512; // 512MB
    if (typeof f.size === "number" && f.size > MAX_BYTES) {
      results.push({ file: f.name, status: "FAILED", error: "file too large" });
      continue;
    }

    const filenameSafe = f.name?.replace(/[^\w.\-]+/g, "_") || `upload_${Date.now()}`;
    const tempPath = path.join(tmpRoot, `${Date.now()}_${filenameSafe}`);

    // Stream browser File to a temp file (no full buffering)
    try {
      await new Promise<void>((resolve, reject) => {
        const nodeReadable = Readable.fromWeb((f as any).stream());
        const writeStream = fs.createWriteStream(tempPath, { flags: "w" });
        nodeReadable.on("error", reject);
        writeStream.on("error", reject);
        writeStream.on("finish", () => resolve());
        nodeReadable.pipe(writeStream);
      });
    } catch (e: any) {
      console.error("Failed to persist upload:", e?.message || e);
      results.push({ file: f.name, status: "FAILED", error: "write failed" });
      continue;
    }

    const mime = f.type || "";
    const kindInput = form.get(`kind_${f.name}`) as string;
    const validTypes = Object.values(ResourceType);
    const kind: ResourceType = validTypes.includes(kindInput as ResourceType)
      ? (kindInput as ResourceType)
      : await guessKind(f.name || filenameSafe, mime, descriptor, "");

    // Choose an S3 key (canonical location of original in prod)
    const s3Key = `classes/${classId}/${Date.now()}_${filenameSafe}`;

    // Create DB row; filePath uses S3 in prod, local path in dev
    const lec = await db.lecture.create({
      data: {
        classId,
        userId: user.id,
        originalName: f.name || path.basename(tempPath),
        filePath: isProd ? s3Key : tempPath,
        mime,
        descriptor,
        kind,
        status: "PROCESSING",
        syncKey: effectiveSyncKey,
      },
    });

    try {
      // Upload the raw file to S3 (prod only)
      if (isProd) {
        const bodyStream = fs.createReadStream(tempPath);
        await new Upload({
          client: s3,
          params: {
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: bodyStream,
            ContentType: mime || "application/octet-stream",
          },
          leavePartsOnError: false,
        }).done();
      }

      // ---- Process from the temp file ----
      let transcriptText = "";
      let textContent = "";
      let durationSec: number | null = null;

      // Optional: cap transcription size
      const TRANSCRIBE_MAX = 1024 * 1024 * 200; // 200MB
      const canTranscribe =
        /^audio\//.test(mime) && (typeof f.size !== "number" || f.size <= TRANSCRIBE_MAX);

      if (canTranscribe && /^audio\//.test(mime)) {
        const { text: tText, segments: segs, duration: dur } = await transcribeLargeAudio(tempPath);
        transcriptText = tText;
        durationSec = dur;

        await db.lecture.update({
          where: { id: lec.id },
          data: {
            durationSec,
            transcript: transcriptText,
            segmentsJson: JSON.stringify(segs),
          },
        });

        const chunks = chunkTranscript(segs);
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
          console.error("embed failed (audio):", e?.message || e);
        }
      } else if (mime === "application/pdf" || filenameSafe.toLowerCase().endsWith(".pdf")) {
        textContent = await readPdf(tempPath);
      } else if (mime === "text/plain" || /\.(txt|md)$/i.test(filenameSafe)) {
        textContent = await readTxt(tempPath);
      } else if (
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        /\.docx$/i.test(filenameSafe)
      ) {
        textContent = await readDocx(tempPath);
      } else if (/^image\//.test(mime) || /\.(png|jpg|jpeg|gif|webp)$/i.test(filenameSafe)) {
        textContent = await ocrImageWithVision(tempPath);
      } else if (!mime && /\.(pdf|txt|md|docx|png|jpg|jpeg|gif|webp)$/i.test(filenameSafe)) {
        if (/\.pdf$/i.test(filenameSafe)) textContent = await readPdf(tempPath);
        else if (/\.(txt|md)$/i.test(filenameSafe)) textContent = await readTxt(tempPath);
        else if (/\.docx$/i.test(filenameSafe)) textContent = await readDocx(tempPath);
        else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(filenameSafe)) textContent = await ocrImageWithVision(tempPath);
      } else {
        textContent = "";
      }

      const manualText2 = (form.get("manualText") as string) || "";
      const manual = manualText2?.trim() ? `\n\n[User Notes]\n${manualText2.trim()}` : "";
      const basis = (transcriptText || textContent || manualText2 || "").slice(0, 12000);

      // Summary (best-effort)
      let summaryContent = "";
      if (basis) {
        const sum = await openai.chat.completions.create({
          model: MODELS.chat,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You are a precise study-notes generator for college STEM courses. Output must be clear, concise, faithful to the source, and formatted in Markdown. Do NOT invent facts.",
            },
            {
              role: "user",
              content: [
                "Create a structured study note from the following lecture text.",
                "",
                "REQUIRED FORMAT (Markdown):",
                "Keywords",
                "Key Learnings",
                "Explanations",
                "Homework",
                "",
                "LECTURE TEXT (first ~12k chars):",
                basis + manual,
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
          kind,
          transcript: transcriptText || undefined,
          textContent: textContent || undefined,
          summaryJson: summaryContent,
          descriptor: descriptor || undefined,
        },
      });

      if (!transcriptText && (textContent || manualText2)) {
        const text = (textContent || "") + (manualText2 ? `\n\n[User Notes]\n${manualText2}` : "");
        const segments = [{ start: 0, end: Math.min(300, Math.ceil(text.length / 6)), text }];
        const chunks = chunkTranscript(segments);

        for (const c of chunks) {
          await db.chunk.create({
            data: {
              classId,
              lectureId: lec.id,
              source: "document",
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
                  source: "document",
                  startSec: chunks[i].start,
                  endSec: chunks[i].end,
                  vectorJson: "",
                },
                data: { vectorJson: JSON.stringify(emb.data[i].embedding) },
              });
            }
          }
        } catch (e: any) {
          console.error("embed failed (document):", e?.message || e);
        }
      }

      // Clean up temp file in prod
      if (isProd) {
        try { await fsp.unlink(tempPath); } catch {}
      }

      results.push({ lectureId: lec.id, status: "READY", key: isProd ? s3Key : tempPath });
    } catch (e: any) {
      console.error("Upload processing failed:", e?.message || e);
      await db.lecture.update({ where: { id: lec.id }, data: { status: "FAILED" } });
      results.push({ lectureId: lec.id, status: "FAILED", error: e?.message || String(e) });
    }
  }

  return NextResponse.json({ ok: true, results });
}
