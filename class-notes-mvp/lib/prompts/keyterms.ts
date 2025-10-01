// src/lib/prompts/keyterms.ts
import { openai, MODELS } from "@/lib/openai";

/** Ask the model for 2–8 concise terms; always return an array of strings. */
export async function generateKeyTerms(basis: string): Promise<string[]> {
  const prompt = [
    "Extract 2–8 concise key terms from the lecture text.",
    "Rules:",
    "- Return ONLY a JSON array of strings.",
    "- 1–3 words per term; no punctuation except hyphens.",
    "- No duplicates; prefer canonical forms (e.g., \"Newton's laws\").",
    "- Skip stopwords; keep domain-specific vocabulary.",
    "",
    "TEXT:",
    (basis || "").slice(0, 8000) // enough signal; cheap & fast
  ].join("\n");

  const r = await openai.chat.completions.create({
    model: MODELS.chat,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = r.choices[0].message.content ?? "[]";

  // Robust parsing (LLMs sometimes wrap JSON)
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return Array.from(new Set(arr.map((s) => String(s).trim()).filter(Boolean))).slice(2, 8);
    }
  } catch {}

  // Fallback: try to salvage comma/line separated output
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```$/, "")
    .replace(/[\[\]]/g, "")
    .split(/[,;\n]/)
    .map((s) => s.replace(/^"|"$/g, "").trim())
    .filter(Boolean);

  // Guarantee 2–8 items if possible
  const unique = Array.from(new Set(cleaned));
  return unique.slice(0, Math.max(2, Math.min(8, unique.length || 0)));
}
