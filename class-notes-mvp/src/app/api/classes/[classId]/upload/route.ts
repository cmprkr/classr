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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Kind =
  | "LECTURE"
  | "SLIDESHOW"
  | "NOTES"
  | "HOMEWORK_GRADED"
  | "HOMEWORK_UNGRADED"
  | "OTHER";

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
): Promise<Kind> {
  const prompt = `You are a classifier. Choose ONE label only from:
- LECTURE
- SLIDESHOW
- NOTES
- HOMEWORK_GRADED
- HOMEWORK_UNGRADED
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
  const map: Record<string, Kind> = {
    LECTURE: "LECTURE",
    SLIDESHOW: "SLIDESHOW",
    NOTES: "NOTES",
    HOMEWORK_GRADED: "HOMEWORK_GRADED",
    "HOMEWORK (GRADED)": "HOMEWORK_GRADED",
    HOMEWORK_UNGRADED: "HOMEWORK_UNGRADED",
    "HOMEWORK (UNGRADED)": "HOMEWORK_UNGRADED",
    OTHER: "OTHER",
  };
  return map[raw] ?? "OTHER";
}

async function ocrImageWithVision(filePath: string): Promise<string> {
  const bytes = await fsp.readFile(filePath);
  const ext = path.extname(filePath).replace(".", "") || "png";
  const b64 = `data:image/${ext};base64,${bytes.toString("base64")}`;
  const res = await openai.chat.completions.create({
    model: MODELS.vision, // define in lib/openai (vision-capable model)
    messages: [
      { role: "system", content: "Extract all legible text from the image. Return plain text only." },
      {
        role: "user",
        content: [
          // types per your SDK; if TS complains, cast to any
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
  // Pure JS entry avoids test assets that can confuse the bundler
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  const data = await pdfParse(await fsp.readFile(filePath));
  return data.text || "";
}

async function readDocx(filePath: string) {
  const { default: mammoth } = await import("mammoth");
  const { value } = await mammoth.extractRawText({ path: filePath });
  return value || "";
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ classId: string }> }
) {
  const { classId } = await ctx.params;
  const user = await requireUser();

  const clazz = await db.class.findFirst({ where: { id: classId, userId: user.id } });
  if (!clazz) return NextResponse.json({ error: "class not found" }, { status: 404 });

  await fsp.mkdir(uploadsPath(), { recursive: true });

  const form = await req.formData();
  const files = form.getAll("file") as File[]; // may be empty if manual text only
  const descriptor = (form.get("descriptor") as string) || undefined;
  const manualText = (form.get("manualText") as string) || ""; // optional pasted transcript/text

  if (!files.length && !manualText.trim()) {
    return NextResponse.json({ error: "no files or manual text" }, { status: 400 });
  }

  const results: any[] = [];

  // Manual text-only item
  if (!files.length && manualText.trim()) {
    const lec = await db.lecture.create({
      data: {
        classId,
        originalName: "Manual Text",
        descriptor,
        kind: "NOTES",
        status: "READY",
        textContent: manualText.trim(),
        transcript: manualText.trim(),
        mime: "text/plain",
      },
    });

    // Create chunk rows first (vectorJson null), then best-effort embed
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
        // Update by (lectureId,start,end,source) is convenient; here we use single-row ids by finding again if needed.
        for (let i = 0; i < chunks.length; i++) {
          // find the chunk we just created
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
      } else {
        console.warn("upload: notes embed skipped (no non-empty chunks)");
      }
    } catch (e: any) {
      console.error("upload: notes embed failed:", e?.message || e);
    }

    results.push({ lectureId: lec.id, status: "READY" });
  }

  // File uploads
  for (const f of files) {
    const arrBuf = await f.arrayBuffer();
    const buf = Buffer.from(arrBuf);
    const filenameSafe = f.name?.replace(/[^\w.\-]+/g, "_") || `upload_${Date.now()}`;
    const dest = uploadsPath(`${Date.now()}_${filenameSafe}`);
    await fsp.writeFile(dest, buf);
    const mime = f.type || "";

    const lec = await db.lecture.create({
      data: {
        classId,
        originalName: f.name || path.basename(dest),
        filePath: dest,
        mime,
        descriptor,
        status: "PROCESSING",
      },
    });

    try {
      let transcriptText = "";
      let textContent = "";
      let durationSec: number | null = null;

      if (/^audio\//.test(mime)) {
        // Transcribe audio
        const fileStream = fs.createReadStream(dest);
        const tr: any = await openai.audio.transcriptions.create({
          model: MODELS.stt,
          file: fileStream,
          response_format: "verbose_json",
        });
        const segments = (tr.segments || []).map((s: any) => ({
          start: Math.floor(s.start),
          end: Math.ceil(s.end),
          text: s.text,
        }));
        transcriptText = tr.text || segments.map((s: any) => s.text).join(" ");
        durationSec = Math.ceil(tr.duration ?? (segments.at(-1)?.end ?? 0));

        // Save transcript first
        await db.lecture.update({
          where: { id: lec.id },
          data: {
            durationSec,
            transcript: transcriptText,
            segmentsJson: JSON.stringify(segments),
          },
        });

        // Chunk rows first (vectorJson null)
        const chunks = chunkTranscript(segments);
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

        // Best-effort embed now
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
          } else {
            console.warn("embed skipped: no non-empty chunks for audio");
          }
        } catch (e: any) {
          console.error("embed failed (audio):", e?.message || e);
        }
      } else if (mime === "application/pdf" || filenameSafe.toLowerCase().endsWith(".pdf")) {
        textContent = await readPdf(dest);
      } else if (mime === "text/plain" || /\.(txt|md)$/i.test(filenameSafe)) {
        textContent = await readTxt(dest);
      } else if (
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        /\.docx$/i.test(filenameSafe)
      ) {
        textContent = await readDocx(dest);
      } else if (/^image\//.test(mime) || /\.(png|jpg|jpeg|gif|webp)$/i.test(filenameSafe)) {
        textContent = await ocrImageWithVision(dest);
      } else if (!mime && /\.(pdf|txt|md|docx|png|jpg|jpeg|gif|webp)$/i.test(filenameSafe)) {
        // Extension fallback
        if (/\.pdf$/i.test(filenameSafe)) textContent = await readPdf(dest);
        else if (/\.(txt|md)$/i.test(filenameSafe)) textContent = await readTxt(dest);
        else if (/\.docx$/i.test(filenameSafe)) textContent = await readDocx(dest);
        else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(filenameSafe)) textContent = await ocrImageWithVision(dest);
      } else {
        textContent = "";
      }

      // Append manual text if provided
      const manual = manualText?.trim() ? `\n\n[User Notes]\n${manualText.trim()}` : "";
      const sampleText = (transcriptText || textContent || "").slice(0, 4000) + manual;

      // Auto-categorize
      const kind = await guessKind(lec.originalName, mime, descriptor, sampleText);

      // Summary (best-effort)
      let summaryContent = "";
      const basis = transcriptText || textContent || manualText || "";
      if (basis) {
        const sum = await openai.chat.completions.create({
          model: MODELS.chat,
          messages: [
            { role: "system", content: "You create concise study notes." },
            {
              role: "user",
              content:
                `Create: (1) 6-8 bullet summary, (2) 6 key terms & defs, (3) 8 flashcards JSON. Text:\n\n` +
                basis.slice(0, 12000),
            },
          ],
          temperature: 0.2,
        });
        summaryContent = sum.choices[0].message.content ?? "";
      }

      // Mark READY with content
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

      // For textual (non-audio) content, create chunk rows first then embed
      if (!transcriptText && (textContent || manualText)) {
        const text = (textContent || "") + (manualText ? `\n\n[User Notes]\n${manualText}` : "");
        const segments = [{ start: 0, end: Math.min(300, Math.ceil(text.length / 6)), text }];
        const chunks = chunkTranscript(segments);

        // Create chunk rows with null vectors
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

        // Best-effort embed
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
          } else {
            console.warn("embed skipped: no non-empty chunks for document");
          }
        } catch (e: any) {
          console.error("embed failed (document):", e?.message || e);
        }
      }

      results.push({ lectureId: lec.id, status: "READY" });
    } catch (e: any) {
      console.error("Upload processing failed:", e?.message || e);
      await db.lecture.update({ where: { id: lec.id }, data: { status: "FAILED" } });
      results.push({ lectureId: lec.id, status: "FAILED", error: e?.message || String(e) });
    }
  }

  return NextResponse.json({ ok: true, results });
}
