// src/components/AllClassesPanel.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Klass = {
  id: string;
  name: string;
  createdAt: string;
  syncKey?: string | null;
  scheduleJson?: any | null; // <- include schedule from API
};

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
const ALL_DAYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Tokens keep it short but unambiguous (Tu vs Th)
const DAY_TOKEN: Record<DayKey, string> = {
  Mon: "M",
  Tue: "Tu",
  Wed: "W",
  Thu: "Th",
  Fri: "F",
  Sat: "Sa",
  Sun: "Su",
};

function formatDays(days: DayKey[]): string {
  // Keep order Mon..Sun, map to tokens, and join with no spaces (e.g., MWF, TuTh)
  const ordered = ALL_DAYS.filter((d) => days.includes(d));
  return ordered.map((d) => DAY_TOKEN[d]).join("");
}

function parseTimeParts(hhmm?: string) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [hhStr, mmStr] = hhmm.split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

  const suf = hh < 12 ? "a" : "p";
  const h12 = ((hh % 12) || 12);
  const base = mm === 0 ? String(h12) : `${h12}:${mmStr}`;
  return {
    withSuf: `${base}${suf}`, // e.g., "9a", "10:15a", "2p"
    noSuf: base,              // e.g., "9", "10:15", "2"
    suf,                      // "a" or "p"
  };
}

function formatRange(start?: string, end?: string): string | null {
  const s = parseTimeParts(start);
  const e = parseTimeParts(end);
  if (!s || !e) return null;
  // If both AM or both PM, show suffix only once at the end: "9–10:15a"
  if (s.suf === e.suf) return `${s.noSuf}–${e.withSuf}`;
  // Otherwise show both: "11:30a–1p"
  return `${s.withSuf}–${e.withSuf}`;
}

function formatSchedule(s: any): string {
  if (!s || typeof s !== "object") return "";
  const days = Array.isArray(s.days)
    ? (s.days.filter((d: any): d is DayKey => ALL_DAYS.includes(d)) as DayKey[])
    : [];

  if (days.length === 0) return "";

  if (s.mode === "per-day") {
    // Group selected days by identical start/end pairs
    const perDay: Record<DayKey, { start?: string; end?: string }> = s.perDay || {};
    const groups: Record<string, DayKey[]> = {}; // key: "start|end"
    for (const d of days) {
      const start = perDay?.[d]?.start;
      const end = perDay?.[d]?.end;
      const key = `${start ?? ""}|${end ?? ""}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }

    // Turn groups into compact strings
    const parts: string[] = [];
    // Preserve day order across groups
    const groupEntries = Object.entries(groups).sort((a, b) => {
      const aFirstIndex = ALL_DAYS.findIndex((d) => groups[a[0]].includes(d));
      const bFirstIndex = ALL_DAYS.findIndex((d) => groups[b[0]].includes(d));
      return aFirstIndex - bFirstIndex;
    });

    for (const [key, ds] of groupEntries) {
      const [start, end] = key.split("|");
      const dayText = formatDays(ds);
      const range = formatRange(start || undefined, end || undefined);
      parts.push(range ? `${dayText} ${range}` : dayText);
    }

    return parts.join("; ");
  }

  // default to uniform
  const range = formatRange(s?.uniform?.start, s?.uniform?.end);
  const dayText = formatDays(days);
  return range ? `${dayText} ${range}` : dayText;
}

export default function AllClassesPanel() {
  const router = useRouter();
  const [classes, setClasses] = useState<Klass[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const r = await fetch("/api/classes");
    if (r.status === 401) {
      setClasses([]);
      return;
    }
    setClasses(await r.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    const r = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      setName("");
      load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this class and all its data?")) return;
    await fetch(`/api/classes/${id}`, { method: "DELETE" });
    load();
  }

  function goToSettings(id: string) {
    router.push(`/class/${id}?tab=class`);
  }

  return (
    <section className="w-96 bg-white border-r overflow-y-auto p-4 space-y-3">
      <h2 className="text-lg font-semibold text-black border-b pb-2 mb-2">
        All Classes ({classes.length})
      </h2>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a class…"
          className="border rounded-lg px-3 py-2 w-full text-black placeholder:text-gray-500 bg-white"
        />
        <button type="button" onClick={create} className="px-4 py-2 rounded-lg bg-black text-white">
          Add
        </button>
      </div>
      <div className="space-y-2">
        {classes.map((c) => {
          const isSynced = !!c.syncKey;
          const cardBase = "p-3 rounded-lg border flex items-start justify-between gap-3";
          const syncedBg =
            "bg-gradient-to-r from-indigo-50 via-fuchsia-50 to-pink-50 hover:from-indigo-100 hover:via-fuchsia-100 hover:to-pink-100 border-fuchsia-200";
          const normalBg = "bg-gray-50 hover:bg-gray-100";

          const scheduleText = formatSchedule(c.scheduleJson);

          return (
            <div
              key={c.id}
              className={`${cardBase} ${isSynced ? syncedBg : normalBg}`}
              title={isSynced ? "Synced class" : undefined}
            >
              <a className="flex-1 min-w-0 block" href={`/class/${c.id}`}>
                <div className="text-sm font-semibold text-gray-900 line-clamp-1">{c.name}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {new Date(c.createdAt).toLocaleString()}
                  {isSynced && (
                    <span className="inline-block rounded-full text-[10px] px-2 py-0.5 bg-pink-100 text-pink-700 border border-pink-200 ml-2">
                      Synced
                    </span>
                  )}
                </div>
                {scheduleText && (
                  <div className="text-xs text-gray-700 mt-0.5 truncate">{scheduleText}</div>
                )}
              </a>
              <div className="flex items-center gap-1.5 self-center">
                <button
                  type="button"
                  onClick={() => goToSettings(c.id)}
                  className="p-2 rounded hover:bg-white"
                  title="Edit class (open settings)"
                  aria-label="Edit class"
                >
                  <img src="/icons/gear.svg" alt="" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="p-2 rounded hover:bg-white"
                  title="Delete class"
                  aria-label="Delete class"
                >
                  <img src="/icons/trash.svg" alt="" className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
