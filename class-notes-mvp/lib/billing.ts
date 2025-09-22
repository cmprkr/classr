import { db } from "@/lib/db";
import type { User } from "@prisma/client";

export const FREE_WEEKLY_MIN = 100;

export function weekStartUTC(d = new Date()) {
  const day = d.getUTCDay();              // 0 Sun..6 Sat
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = (day + 6) % 7;             // days since Monday
  return new Date(midnight - diff * 86400000);
}

export function isPremium(u: Pick<User, "planTier" | "planStatus"> | null | undefined) {
  return u?.planTier === "PREMIUM" && u?.planStatus === "active";
}

export async function getUsedMinutesThisWeek(userId: string, when = new Date()) {
  const week = weekStartUTC(when);
  const row = await db.usageCounter.findUnique({
    where: { userId_weekStart: { userId, weekStart: week } },
    select: { minutes: true },
  });
  return { weekStart: week, minutes: row?.minutes ?? 0 };
}

export async function addMinutesThisWeek(userId: string, minutes: number, when = new Date()) {
  const week = weekStartUTC(when);
  await db.usageCounter.upsert({
    where: { userId_weekStart: { userId, weekStart: week } },
    create: { userId, weekStart: week, minutes },
    update: { minutes: { increment: minutes } },
  });
}
