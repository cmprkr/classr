// src/app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function okRedirect(req: Request, to = "/auth/signin?new=1") {
  return NextResponse.redirect(new URL(to, req.url), { status: 303 });
}

function bad(status: number, msg: string) {
  return NextResponse.json({ error: msg }, { status });
}

function getStr(v: FormDataEntryValue | null | undefined) {
  return (typeof v === "string" ? v : "").trim();
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;

export async function POST(req: Request) {
  try {
    const ctype = req.headers.get("content-type") || "";

    let name = "";
    let email = "";
    let password = "";
    let username = "";
    // NEW: optional default university domain
    let defaultUniversityDomain: string | null = null;

    if (ctype.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as any;
      name = (body?.name ?? "").trim();
      email = (body?.email ?? "").trim().toLowerCase();
      password = (body?.password ?? "").trim();
      username = (body?.username ?? "").trim();
      const dom = (body?.defaultUniversityDomain ?? "").trim().toLowerCase();
      defaultUniversityDomain = dom ? dom : null;
    } else if (
      ctype.includes("application/x-www-form-urlencoded") ||
      ctype.includes("multipart/form-data")
    ) {
      const fd = await req.formData();
      name = getStr(fd.get("name"));
      email = getStr(fd.get("email")).toLowerCase();
      password = getStr(fd.get("password"));
      username = getStr(fd.get("username"));
      const dom = getStr(fd.get("defaultUniversityDomain")).toLowerCase();
      defaultUniversityDomain = dom ? dom : null;
    } else {
      const body = (await req.json().catch(() => ({}))) as any;
      name = (body?.name ?? "").trim();
      email = (body?.email ?? "").trim().toLowerCase();
      password = (body?.password ?? "").trim();
      username = (body?.username ?? "").trim();
      const dom = (body?.defaultUniversityDomain ?? "").trim().toLowerCase();
      defaultUniversityDomain = dom ? dom : null;
    }

    if (!email || !password || !username) {
      return bad(400, "Missing required fields");
    }
    if (!USERNAME_RE.test(username)) {
      return bad(400, "Invalid username (3–30 chars: letters, numbers, _.-)");
    }

    // Check uniqueness for email and username
    const existing = await db.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true, email: true, username: true },
    });
    if (existing?.email === email) return bad(409, "Email already in use");
    if (existing?.username === username) return bad(409, "Username already in use");

    const passwordHash = await bcrypt.hash(password, 11);

    await db.user.create({
      data: {
        name: name || null,
        email,
        username,
        passwordHash,
        defaultUniversityDomain, // ✅ optional
      },
    });

    return okRedirect(req);
  } catch (e: any) {
    console.error("signup error:", e?.message || e);
    return bad(500, "Internal error");
  }
}
