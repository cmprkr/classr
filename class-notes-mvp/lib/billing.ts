import { db } from "@/lib/db";
import type { User } from "@prisma/client";
import type { PlanTier } from "@prisma/client";


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

/** Sum all minutes ever recorded for the user */
export async function getAllTimeMinutes(userId: string) {
  const agg = await db.usageCounter.aggregate({
    where: { userId },
    _sum: { minutes: true },
  });
  return agg._sum.minutes ?? 0;
}

/** Allowance: null = unlimited */
export function weeklyAllowanceFor(plan: PlanTier | null | undefined): number | null {
  return plan === "PREMIUM" ? null : FREE_WEEKLY_MIN;
}

/** Full usage snapshot for UI */
export async function getUsageSnapshot(userId: string, plan: PlanTier) {
  const { weekStart, minutes: usedThisWeek } = await getUsedMinutesThisWeek(userId);
  const allTime = await getAllTimeMinutes(userId);
  const allowance = weeklyAllowanceFor(plan);               // null = unlimited
  const remaining = allowance == null ? null : Math.max(0, allowance - usedThisWeek);
  const resetsAt = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    usedThisWeek,
    allTime,
    allowance,     // number | null
    remaining,     // number | null
    weekStart,
    resetsAt,
    plan,
  };
}