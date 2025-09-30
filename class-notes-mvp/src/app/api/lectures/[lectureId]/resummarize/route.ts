// src/app/api/lectures/[lectureId]/resummarize/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { openai, MODELS } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ lectureId: string }> }
) {
  const { lectureId } = await ctx.params;
  const user = await requireUser();

  const lecture = await db.lecture.findFirst({
    where: { id: lectureId, userId: user.id },
    select: {
      id: true,
      transcript: true,
      textContent: true,
      descriptor: true,
      originalName: true,
    },
  });

  if (!lecture) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const basisRaw =
    (lecture.transcript || "") +
    (lecture.textContent ? `\n\n${lecture.textContent}` : "");

  const basis = basisRaw.slice(0, 12000);

  if (!basis.trim()) {
    return NextResponse.json(
      { error: "No source text available to summarize" },
      { status: 400 }
    );
  }

  const sys = [
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
  ].join("\n");

  const userMsg = [
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
    basis,
  ].join("\n");

  const resp = await openai.chat.completions.create({
    model: MODELS.chat,
    temperature: 0.1,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: userMsg },
    ],
  });

  const summaryJson = resp.choices[0].message.content ?? "";

  await db.lecture.update({
    where: { id: lecture.id },
    data: { summaryJson },
  });

  return NextResponse.json({ summaryJson });
}
