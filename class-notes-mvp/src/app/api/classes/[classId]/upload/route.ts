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

import { parseFile } from "music-metadata";
import { getUsedMinutesThisWeek, addMinutesThisWeek, FREE_WEEKLY_MIN } from "@/lib/billing";

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

// ---------- Helpers ----------
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

  const form = await req.formData();
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
                "7) If no explicit homework is provided, generate 5 practice problems strictly grounded in the presented material (no external facts). Provide brief answers at the end.",
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
                "## Glossary (Optional if redundant with Key Terms)",
                "- Only include if additional everyday-language clarifications would help.",
                "",
                "## Source Notes",
                "- If quoting, use backticks for short quotes.",
                "- If the text references figures or slides, summarize their content in 1–2 bullets each.",
                "",
                "LECTURE TEXT (first ~12k chars follows):",
                (basis + ((manual?.trim()?.length ? `\n\n[User Notes]\n${manual.trim()}` : ""))),
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
