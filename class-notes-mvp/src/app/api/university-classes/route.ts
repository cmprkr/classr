// src/app/api/university-classes/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fsp from "node:fs/promises";
import { pathToFileURL } from "node:url";

function slugifyCountry(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type UniClass = { code: string; name: string; syncKey: string };

async function fileExists(p: string) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const country = (url.searchParams.get("country") || "").trim();
    const domain = (url.searchParams.get("domain") || "").trim().toLowerCase();

    if (!country || !domain) {
      return NextResponse.json(
        { error: "Missing query params: country & domain are required" },
        { status: 400 }
      );
    }

    const baseDir = path.join(
      process.cwd(),
      "data",
      "universities",
      slugifyCountry(country),
      domain
    );

    const jsonPath = path.join(baseDir, "classes.json");
    const mjsPath = path.join(baseDir, "classes.mjs");

    let classes: UniClass[] | undefined;

    if (await fileExists(jsonPath)) {
      // JSON fast path
      const buf = await fsp.readFile(jsonPath, "utf8");
      const parsed = JSON.parse(buf);
      if (Array.isArray(parsed)) classes = parsed as UniClass[];
      else if (Array.isArray((parsed as any).classes)) classes = (parsed as any).classes as UniClass[];
    } else if (await fileExists(mjsPath)) {
      // MJS path — import the file directly at runtime (skip bundler)
      // @ts-ignore
      const mod = await import(/* webpackIgnore: true */ pathToFileURL(mjsPath).href);
      const maybe =
        (mod && (mod.CLASS_LIST as UniClass[] | undefined)) ||
        (mod && (mod.default as UniClass[] | { classes?: UniClass[] } | undefined));

      if (Array.isArray(maybe)) classes = maybe;
      else if (maybe && Array.isArray((maybe as any).classes)) classes = (maybe as any).classes;
    } else {
      return NextResponse.json(
        {
          error: `No classes file found. Expected one of:\n- ${jsonPath}\n- ${mjsPath}`,
        },
        { status: 404 }
      );
    }

    if (!classes || !Array.isArray(classes)) {
      return NextResponse.json(
        {
          error:
            "Classes file found but not in expected format. Expected an array of { code, name, syncKey }.",
        },
        { status: 422 }
      );
    }

    // light validation
    const cleaned = classes
      .filter(
        (c) =>
          c &&
          typeof c.code === "string" &&
          typeof c.name === "string" &&
          typeof c.syncKey === "string"
      )
      .map((c) => ({ code: c.code, name: c.name, syncKey: c.syncKey }));

    return NextResponse.json({ classes: cleaned });
  } catch (e: any) {
    console.error("university-classes error:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
