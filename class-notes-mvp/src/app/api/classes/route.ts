// src/app/api/classes/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const classes = await db.class.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(classes);
  } catch (e: any) {
    const status = e?.status === 401 ? 401 : 500;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    // accept JSON or form-encoded (defensive)
    let name = "";
    let scheduleJson: any = undefined;
    let isActive: boolean | undefined = undefined; // ✅ new

    const ctype = req.headers.get("content-type") || "";
    if (ctype.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      name = (body?.name ?? "").trim();
      scheduleJson = body?.scheduleJson ?? undefined;
      if (typeof body?.isActive === "boolean") isActive = body.isActive; // ✅
    } else if (
      ctype.includes("application/x-www-form-urlencoded") ||
      ctype.includes("multipart/form-data")
    ) {
      const fd = await req.formData();
      name = String(fd.get("name") || "").trim();

      const schedRaw = fd.get("scheduleJson");
      if (typeof schedRaw === "string" && schedRaw) {
        try {
          scheduleJson = JSON.parse(schedRaw);
        } catch {
          scheduleJson = undefined;
        }
      }

      const isActiveRaw = fd.get("isActive"); // ✅
      if (typeof isActiveRaw === "string") {
        // accept "true"/"false"
        isActive = isActiveRaw === "true";
      }
    } else {
      const body = await req.json().catch(() => ({}));
      name = (body?.name ?? "").trim();
      scheduleJson = body?.scheduleJson ?? undefined;
      if (typeof body?.isActive === "boolean") isActive = body.isActive; // ✅
    }

    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    const created = await db.class.create({
      data: {
        name,
        userId: user.id,
        scheduleJson: scheduleJson ?? undefined,
        ...(isActive !== undefined ? { isActive } : {}), // ✅ default handled by prisma
      },
    });
    return NextResponse.json(created);
  } catch (e: any) {
    const status = e?.status === 401 ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Please sign in again." : "Create failed" },
      { status }
    );
  }
}
