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