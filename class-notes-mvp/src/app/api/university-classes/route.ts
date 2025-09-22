export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import path from "node:path";
import fsp from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { NextResponse } from "next/server";

async function exists(p: string) {
  try { await fsp.access(p); return true; } catch { return false; }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const country = (searchParams.get("country") || "").trim().toLowerCase();
    const domain  = (searchParams.get("domain")  || "").trim().toLowerCase();
    if (!country || !domain) {
      return NextResponse.json({ error: "country and domain required" }, { status: 400 });
    }

    const mjsPath  = path.join(process.cwd(), "data", "universities", country, domain, "classes.mjs");
    const jsonPath = path.join(process.cwd(), "data", "universities", country, domain, "classes.json");

    let classes: any[] | null = null;

    if (await exists(mjsPath)) {
      const mod = await import(pathToFileURL(mjsPath).href);
      classes = mod?.default ?? mod?.CLASS_LIST ?? null;
    } else if (await exists(jsonPath)) {
      const raw = await fsp.readFile(jsonPath, "utf8");
      classes = JSON.parse(raw);
    }

    if (!Array.isArray(classes)) {
      return NextResponse.json(
        { error: `Classes not found at ${mjsPath} or ${jsonPath}` },
        { status: 404 }
      );
    }

    const out = classes.map((c: any) => ({
      code: String(c?.code ?? ""),
      name: String(c?.name ?? ""),
      syncKey: String(c?.syncKey ?? ""),
    })).filter((c) => c.code && c.name && c.syncKey);

    return NextResponse.json({ classes: out });
  } catch (e: any) {
    console.error("university-classes error:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
