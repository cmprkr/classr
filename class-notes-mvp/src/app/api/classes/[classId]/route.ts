// src/app/api/classes/[classId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import fsp from "fs/promises";

// -------- schedule typing & sanitization --------
type ClientSchedule =
  | {
      days: string[];
      mode: "uniform";
      uniform?: { start?: string; end?: string; timezone?: string };
    }
  | {
      days: string[];
      mode: "per-day";
      perDay?: Record<string, { start?: string; end?: string }>;
    };

const VALID_DAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

function isHHMM(v: unknown): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}

/** Best-effort server-side cleaning; returns null if the shape is bad. */
function sanitizeSchedule(s: any): ClientSchedule | null {
  if (!s || typeof s !== "object") return null;

  const rawDays = Array.isArray(s.days) ? s.days : [];
  const days = rawDays.filter((d: any) => typeof d === "string" && VALID_DAYS.has(d));
  if (days.length === 0) {
    // allow empty schedule, but it should still be structurally valid
    if (s.mode === "uniform") {
      const tz = typeof s?.uniform?.timezone === "string" ? s.uniform.timezone : undefined;
      const u = {
        start: isHHMM(s?.uniform?.start) ? s.uniform.start : undefined,
        end: isHHMM(s?.uniform?.end) ? s.uniform.end : undefined,
        timezone: tz,
      };
      return { days: [], mode: "uniform", uniform: u };
    }
    if (s.mode === "per-day") {
      return { days: [], mode: "per-day" };
    }
    return { days: [], mode: "uniform" };
  }

  if (s.mode === "per-day") {
    const per: Record<string, { start?: string; end?: string }> = {};
    const rawPer = s?.perDay && typeof s.perDay === "object" ? s.perDay : {};
    for (const d of days) {
      const ent = rawPer[d] || {};
      const start = isHHMM(ent.start) ? ent.start : undefined;
      const end = isHHMM(ent.end) ? ent.end : undefined;
      if (start || end) per[d] = { start, end };
    }
    return { days, mode: "per-day", perDay: Object.keys(per).length ? per : undefined };
  }

  // default to uniform
  const tz = typeof s?.uniform?.timezone === "string" ? s.uniform.timezone : undefined;
  const start = isHHMM(s?.uniform?.start) ? s.uniform.start : undefined;
  const end = isHHMM(s?.uniform?.end) ? s.uniform.end : undefined;
  return { days, mode: "uniform", uniform: { start, end, timezone: tz } };
}

// -------- handlers --------
export async function GET(_req: Request, ctx: { params: Promise<{ classId: string }> }) {
  const { classId } = await ctx.params;
  const user = await requireUser();

  const clazz = await db.class.findFirst({
    where: { id: classId, userId: user.id },
    select: {
      id: true,
      name: true,
      syncEnabled: true,
      syncKey: true,
      scheduleJson: true, // ✅ include schedule
    },
  });
  if (!clazz) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(clazz);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ classId: string }> }) {
  const { classId } = await ctx.params;
  const user = await requireUser();
  const body = await req.json();

  const { name, syncEnabled, syncKey, scheduleJson } = body as {
    name?: string;
    syncEnabled?: boolean;
    syncKey?: string | null;
    scheduleJson?: ClientSchedule | null; // may be null to clear
  };

  const clazz = await db.class.findFirst({
    where: { id: classId, userId: user.id },
  });
  if (!clazz) return NextResponse.json({ error: "not found" }, { status: 404 });

  let scheduleUpdate: Record<string, any> = {};
  if (scheduleJson !== undefined) {
    // accept null to clear, or sanitize if provided
    scheduleUpdate = {
      scheduleJson: scheduleJson === null ? null : (sanitizeSchedule(scheduleJson) as any),
    };
  }

  const updated = await db.class.update({
    where: { id: classId },
    data: {
      ...(typeof name === "string" ? { name } : {}),
      ...(typeof syncEnabled === "boolean" ? { syncEnabled } : {}),
      ...(syncKey !== undefined ? { syncKey } : {}),
      ...scheduleUpdate, // ✅ persist schedule
    },
    select: {
      id: true,
      name: true,
      syncEnabled: true,
      syncKey: true,
      scheduleJson: true, // ✅ return schedule to client
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ classId: string }> }) {
  const { classId } = await ctx.params;
  const user = await requireUser();

  const clazz = await db.class.findFirst({
    where: { id: classId, userId: user.id },
    include: { lectures: true },
  });
  if (!clazz) return NextResponse.json({ ok: true });

  // delete files first
  await Promise.all(
    clazz.lectures
      .map((l) => l.filePath)
      .filter(Boolean)
      .map((fp) => fsp.unlink(fp!).catch(() => {}))
  );

  await db.$transaction([
    db.chunk.deleteMany({ where: { classId } }),
    db.lecture.deleteMany({ where: { classId } }),
    db.class.delete({ where: { id: classId } }),
  ]);

  return NextResponse.json({ ok: true });
}
