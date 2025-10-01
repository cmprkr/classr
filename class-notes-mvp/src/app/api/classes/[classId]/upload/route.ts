// src/app/api/classes/[classId]/upload/route.ts

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
import { buildSummaryMessages } from "@/lib/prompts/summary";

import { parseFile } from "music-metadata";
import { getUsedMinutesThisWeek, addMinutesThisWeek, FREE_WEEKLY_MIN, weekStartUTC } from "@/lib/billing";

// AWS Transcribe & S3
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- S3 configuration ---
const S3_BUCKET = process.env.S3_BUCKET!;
const S3_REGION = process.env.S3_REGION!;
const s3 = new S3Client({ region: S3_REGION });

// --- Transcribe configuration ---
const transcribe = new TranscribeClient({ region: S3_REGION });

// Keep a margin under OpenAI’s ~25MB cap for audio uploads:
const OPENAI_LIMIT = 24 * 1024 * 1024; // 24MB
const AUDIO_EXT_RE = /\.(mp3|m4a|wav|aac|flac|ogg|oga|webm)$/i;

// ---------- Shared helpers ----------
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

async function startTranscribeForS3Key(
  bucket: string,
  key: string,
  lang: "en-US" | "auto" = "en-US"
) {
  const jobName = `classr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await transcribe.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: { MediaFileUri: `s3://${bucket}/${key}` }, // s3 URI
      MediaFormat: "mp3",
      LanguageCode: lang === "en-US" ? "en-US" : undefined,
      IdentifyLanguage: lang === "auto" ? true : undefined,
    })
  );
  return jobName;
}

async function waitTranscribe(jobName: string, timeoutMs = 60 * 60 * 1000, pollMs = 5000) {
  const start = Date.now();
  while (true) {
    const r = await transcribe.send(
      new GetTranscriptionJobCommand({ TranscriptionJobName: jobName })
    );
    const s = r.TranscriptionJob?.TranscriptionJobStatus;
    if (s === "COMPLETED") return r;
    if (s === "FAILED") throw new Error(r.TranscriptionJob?.FailureReason || "Transcribe failed");
    if (Date.now() - start > timeoutMs) throw new Error("Transcribe timeout");
    await new Promise((res) => setTimeout(res, pollMs));
  }
}

async function fetchTranscriptText(uri: string) {
  const json = await fetch(uri).then((r) => r.json());
  const full = (json?.results?.transcripts || [])
    .map((t: any) => t?.transcript || "")
    .join(" ")
    .trim();

  // build coarse ~15s segments from word timings
  const items: any[] = json?.results?.items || [];
  const words = items.filter((i: any) => i.type === "pronunciation");
  const segments: { start: number; end: number; text: string }[] = [];
  let curText: string[] = [];
  let winStart = words.length ? Math.floor(parseFloat(words[0].start_time)) : 0;
  let lastEnd = winStart;

  for (const w of words) {
    const et = Math.ceil(parseFloat(w.end_time || w.start_time));
    curText.push(w.alternatives?.[0]?.content || "");
    lastEnd = et;
    if (et - winStart >= 15) {
      segments.push({ start: winStart, end: et, text: curText.join(" ") });
      curText = [];
      winStart = et;
    }
  }
  if (curText.length) segments.push({ start: winStart, end: lastEnd, text: curText.join(" ") });

  const duration = lastEnd;
  return { text: full, segments, duration };
}

// ---------- Recorder-mode stitching (when parts come via this route) ----------
type RecorderPart = {
  chunkIndex: number;
  text: string;
  duration: number; // seconds (local to chunk)
  segments: { start: number; end: number; text: string }[];
};

async function handleRecorderFinalize(
  {
    classId, userId, filename, descriptor, parts,
  }: { classId: string; userId: string; filename: string; descriptor?: string; parts: RecorderPart[] }
) {
  // Sort parts and build global transcript/segments
  parts.sort((a, b) => a.chunkIndex - b.chunkIndex);
  const totalSec = parts.reduce((s, p) => s + Math.max(0, Math.floor(p.duration || 0)), 0);
  const totalMin = Math.max(1, Math.ceil(totalSec / 60));

  let offset = 0;
  let transcriptText = "";
  const globalSegments: { start: number; end: number; text: string }[] = [];

  for (const p of parts) {
    const dur = Math.max(0, Math.floor(p.duration || 0));
    const t = (p.text || "").trim();
    if (t) transcriptText += (transcriptText ? " " : "") + t;
    for (const s of p.segments || []) {
      const start = Math.max(0, Math.floor((s.start || 0) + offset));
      const end = Math.max(start, Math.floor((s.end || 0) + offset));
      const txt = String(s.text || "").trim();
      if (txt) globalSegments.push({ start, end, text: txt });
    }
    offset += dur;
  }

  // Create lecture
  const lec = await db.lecture.create({
    data: {
      classId,
      userId,
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

  // Create chunks + embeddings
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
    console.error("upload(recorder): embedding failed:", e?.message || e);
  }

  // Generate summary
  let summaryContent = "";
  const basis = transcriptText.slice(0, 12000);
  if (basis) {
    const sum = await openai.chat.completions.create({
      model: MODELS.chat,
      temperature: 0.1,
      messages: [...buildSummaryMessages({
        basis,
        includeSourceNotes: false, // match prior behavior for this branch
      })],
    });
    summaryContent = sum.choices[0].message.content ?? "";
  }

  await db.lecture.update({
    where: { id: lec.id },
    data: { status: "READY", summaryJson: summaryContent },
  });

  await addMinutesThisWeek(userId, totalMin);
  return { lectureId: lec.id, durationSec: totalSec };
}

// ---------- Route handler ----------
export async function POST(
  req: NextRequest,
  ctx: { params: { classId: string } }
) {
  const { classId } = ctx.params;
  const user = await requireUser();

  const clazz = await db.class.findFirst({
    where: { id: classId, userId: user.id },
    select: { id: true, name: true, syncEnabled: true, syncKey: true },
  });
  if (!clazz) return NextResponse.json({ error: "class not found" }, { status: 404 });

  const effectiveSyncKey = clazz.syncEnabled ? clazz.syncKey ?? null : null;

  // Use /tmp in prod; local path in dev.
  const isProd = process.env.NODE_ENV === "production";
  const tmpRoot = isProd ? "/tmp/uploads" : uploadsPath();
  await fsp.mkdir(tmpRoot, { recursive: true });

  // Accept either multipart (legacy or recorder parts) or JSON (rare)
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    // Optional: allow recorder finalize via JSON to this endpoint too
    const body = await req.json().catch(() => null as any);
    if (Array.isArray(body?.parts) && body?.parts.length) {
      const filename = String(body?.filename || `recording_${Date.now()}.webm`);
      const descriptor = body?.descriptor || undefined;
      const parts = body.parts as RecorderPart[];

      // Free limit check based on *actual* duration
      const totalSec = parts.reduce((s, p) => s + Math.max(0, Math.floor(p.duration || 0)), 0);
      const totalMin = Math.max(1, Math.ceil(totalSec / 60));
      const u = await db.user.findUnique({
        where: { id: user.id },
        select: { planTier: true, planStatus: true },
      });
      const premium = u?.planTier === "PREMIUM" && u?.planStatus === "active";
      if (!premium) {
        const { minutes } = await getUsedMinutesThisWeek(user.id);
        if (minutes + totalMin > FREE_WEEKLY_MIN) {
          return NextResponse.json(
            { error: "limit_reached", detail: `Weekly audio limit: ${minutes}/${FREE_WEEKLY_MIN} used.` },
            { status: 402 }
          );
        }
      }

      const out = await handleRecorderFinalize({ classId, userId: user.id, filename, descriptor, parts });
      return NextResponse.json({ ok: true, ...out });
    }
    // Fall through to legacy behavior if not recorder JSON
  }

  // Multipart form (legacy upload OR recorder-parts-in-form)
  const form = await req.formData();

  // Recorder-mode in multipart: `recordingParts` = JSON string of parts
  const recorderPartsRaw = form.get("recordingParts");
  if (recorderPartsRaw) {
    let parts: RecorderPart[] = [];
    try {
      const parsed = JSON.parse(String(recorderPartsRaw));
      if (Array.isArray(parsed)) parts = parsed;
    } catch {}
    if (!parts.length) {
      return NextResponse.json({ error: "invalid recordingParts" }, { status: 400 });
    }

    const filename = String(form.get("filename") || `recording_${Date.now()}.webm`);
    const descriptor = (form.get("descriptor") as string) || undefined;

    // Enforce free limit based on actual duration
    const totalSec = parts.reduce((s, p) => s + Math.max(0, Math.floor(p.duration || 0)), 0);
    const totalMin = Math.max(1, Math.ceil(totalSec / 60));
    const u = await db.user.findUnique({
      where: { id: user.id },
      select: { planTier: true, planStatus: true },
    });
    const premium = u?.planTier === "PREMIUM" && u?.planStatus === "active";
    if (!premium) {
      const { minutes } = await getUsedMinutesThisWeek(user.id);
      if (minutes + totalMin > FREE_WEEKLY_MIN) {
        return NextResponse.json(
          { error: "limit_reached", detail: `Weekly audio limit: ${minutes}/${FREE_WEEKLY_MIN} used.` },
          { status: 402 }
        );
      }
    }

    const out = await handleRecorderFinalize({ classId, userId: user.id, filename, descriptor, parts });
    return NextResponse.json({ ok: true, ...out });
  }

  // ------- Legacy: file uploads path -------
  const files = form.getAll("file") as File[];
  const descriptor = (form.get("descriptor") as string) || undefined;
  const manualText = (form.get("manualText") as string) || "";

  if (!files.length && !manualText.trim()) {
    return NextResponse.json({ error: "no files or manual text" }, { status: 400 });
  }

  const results: any[] = [];

  // --------- Manual text-only path ----------
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
      {
        start: 0,
        end: Math.min(300, Math.ceil(manualText.length / 6)),
        text: manualText.slice(0, 12000),
      },
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

  // --------- File uploads (legacy) ----------
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
    const isAudio = /^audio\//.test(mime) || AUDIO_EXT_RE.test(filenameSafe);

    // --- Paywall gate: estimate minutes BEFORE transcription/DB row ---
    if (isAudio) {
      let estMinutes = 0;
      try {
        const meta = await parseFile(tempPath);
        const durSec = Math.ceil(meta.format.duration ?? 0);
        estMinutes = Math.max(1, Math.ceil(durSec / 60));
      } catch {
        estMinutes = 0; // unknown → don't block spuriously
      }

      // Fetch plan & usage
      const u = await db.user.findUnique({
        where: { id: user.id },
        select: { planTier: true, planStatus: true },
      });
      const premium = u?.planTier === "PREMIUM" && u?.planStatus === "active";

      if (!premium && estMinutes > 0) {
        const { minutes } = await getUsedMinutesThisWeek(user.id);
        if (minutes + estMinutes > FREE_WEEKLY_MIN) {
          if (isProd) {
            try {
              await fsp.unlink(tempPath);
            } catch {}
          }
          results.push({
            file: f.name,
            status: "FAILED",
            error: `Weekly audio limit reached: ${minutes}/${FREE_WEEKLY_MIN} minutes used. Upgrade for unlimited.`,
          });
          continue; // next file
        }
      }
    }

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

      if (isAudio) {
        if (!isProd) {
          // Dev: OpenAI path
          const r = await transcribeWithOpenAI(tempPath);
          transcriptText = r.text;
          durationSec = r.duration;

          await db.lecture.update({
            where: { id: lec.id },
            data: { durationSec, transcript: transcriptText, segmentsJson: JSON.stringify(r.segments) },
          });

          const chunks = chunkTranscript(r.segments);
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
            console.error("embed failed (audio dev):", e?.message || e);
          }
        } else {
          // Prod: choose provider by size
          const size = typeof f.size === "number" ? f.size : 0;

          if (size <= OPENAI_LIMIT) {
            // small → OpenAI
            const r = await transcribeWithOpenAI(tempPath);
            transcriptText = r.text;
            durationSec = r.duration;

            await db.lecture.update({
              where: { id: lec.id },
              data: { durationSec, transcript: transcriptText, segmentsJson: JSON.stringify(r.segments) },
            });

            const chunks = chunkTranscript(r.segments);
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
              console.error("embed failed (audio small):", e?.message || e);
            }
          } else {
            // large → Amazon Transcribe
            const job = await startTranscribeForS3Key(S3_BUCKET, s3Key, "en-US");
            const done = await waitTranscribe(job);
            const uri = done.TranscriptionJob?.Transcript?.TranscriptFileUri;
            if (!uri) throw new Error("No transcript URI from Transcribe");

            const r = await fetchTranscriptText(uri);
            transcriptText = r.text;
            durationSec = r.duration;

            await db.lecture.update({
              where: { id: lec.id },
              data: { durationSec, transcript: transcriptText, segmentsJson: JSON.stringify(r.segments) },
            });

            const chunks = chunkTranscript(r.segments);
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
              console.error("embed failed (audio large):", e?.message || e);
            }
          }
        }

        // ---- Usage tracking (ALL plans) ----
        if (durationSec && durationSec > 0) {
          const minutesActual = Math.max(1, Math.ceil(durationSec / 60));
          await addMinutesThisWeek(user.id, minutesActual);
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
        else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(filenameSafe)) textContent = await ocrImageWithVision(
          tempPath
        );
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
          temperature: 0.1,
          messages: buildSummaryMessages({
            basis,
            includeSourceNotes: true, // this branch previously had “## Source Notes”
            // If you want to keep appending the [User Notes] footer, you can:
            // extraFooter: manual?.trim() ? `\n\n[User Notes]\n${manual.trim()}` : undefined,
          }).slice(),
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

      // Clean up temp file in prod
      if (isProd) {
        try {
          await fsp.unlink(tempPath);
        } catch {}
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
