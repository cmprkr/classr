"use client";

import { useEffect, useState } from "react";

type UsageSnap = {
  usedThisWeek: number;
  allTime: number;
  allowance: number | null;  // null = unlimited
  remaining: number | null;  // null = unlimited
  weekStart: string;         // ISO
  resetsAt: string;          // ISO
  plan: "FREE" | "PREMIUM";
};

function fmt(n: number) {
  return new Intl.NumberFormat().format(Math.max(0, Math.floor(n)));
}

export default function UsageCard() {
  const [data, setData] = useState<UsageSnap | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/billing/usage", { cache: "no-store" });
        if (!r.ok) throw new Error(await r.text());
        const json = await r.json();
        if (!alive) return;
        // coerce dates to ISO strings for consistent rendering
        json.weekStart = new Date(json.weekStart).toISOString();
        json.resetsAt = new Date(json.resetsAt).toISOString();
        setData(json);
      } catch (e: any) {
        setErr(e?.message || "Failed to load usage");
      }
    })();
    return () => { alive = false; };
  }, []);

  if (err) {
    return (
      <div className="mt-4 rounded-xl border bg-white p-4">
        <div className="text-sm text-red-700">Usage error: {err}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mt-4 rounded-xl border bg-white p-4">
        <div className="text-sm text-gray-500">Loading usage…</div>
      </div>
    );
  }

  const resetsLocal = new Date(data.resetsAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const pct =
    data.allowance == null
      ? 0
      : Math.min(100, Math.round((data.usedThisWeek / Math.max(1, data.allowance)) * 100));

  return (
    <div className="mt-4 rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-gray-900">Usage</div>
        <div className="text-xs rounded-full px-2 py-1 bg-gray-100 text-gray-700">
          {data.plan === "PREMIUM" ? "Premium (unlimited)" : "Free"}
        </div>
      </div>

      {data.allowance == null ? (
        <>
          <div className="text-sm text-gray-700">Weekly usage: {fmt(data.usedThisWeek)} min</div>
        </>
      ) : (
        <>
          <div className="text-sm text-gray-700">
            Weekly usage: {fmt(data.usedThisWeek)} / {fmt(data.allowance)} min
          </div>
          <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
            <div
              className="h-2 bg-black"
              style={{ width: `${pct}%` }}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="text-xs text-gray-600">
            Remaining: {fmt(data.remaining ?? 0)} min · Resets {resetsLocal}
          </div>
        </>
      )}

      <div className="text-sm text-gray-700">All-time: {fmt(data.allTime)} min</div>
    </div>
  );
}
