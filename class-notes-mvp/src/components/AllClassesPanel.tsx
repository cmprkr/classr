// src/components/AllClassesPanel.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Klass = {
  id: string;
  name: string;
  createdAt: string;
  syncKey?: string | null;
  scheduleJson?: any | null; // must be returned by /api/classes
  isActive?: boolean;        // used for the Active/Inactive tag and toggle
};

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
const ALL_DAYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
  const h12 = (hh % 12) || 12;
  const base = mm === 0 ? String(h12) : `${h12}:${mmStr}`;
  return { withSuf: `${base}${suf}`, noSuf: base, suf };
}
function formatRange(start?: string, end?: string): string | null {
  const s = parseTimeParts(start);
  const e = parseTimeParts(end);
  if (!s || !e) return null;
  return s.suf === e.suf ? `${s.noSuf}–${e.withSuf}` : `${s.withSuf}–${e.withSuf}`;
}
function formatSchedule(s: any): string {
  if (!s || typeof s !== "object") return "";
  const days = Array.isArray(s.days)
    ? (s.days.filter((d: any): d is DayKey => ALL_DAYS.includes(d)) as DayKey[])
    : [];
  if (days.length === 0) return "";

  if (s.mode === "per-day") {
    const perDay: Record<DayKey, { start?: string; end?: string }> = s.perDay || {};
    const groups: Record<string, DayKey[]> = {};
    for (const d of days) {
      const start = perDay?.[d]?.start;
      const end = perDay?.[d]?.end;
      const key = `${start ?? ""}|${end ?? ""}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }
    const entries = Object.entries(groups).sort((a, b) => {
      const ai = ALL_DAYS.findIndex((d) => groups[a[0]].includes(d));
      const bi = ALL_DAYS.findIndex((d) => groups[b[0]].includes(d));
      return ai - bi;
    });
    return entries
      .map(([key, ds]) => {
        const [start, end] = key.split("|");
        const dayText = formatDays(ds);
        const range = formatRange(start || undefined, end || undefined);
        return range ? `${dayText} ${range}` : dayText;
      })
      .join("; ");
  }

  const range = formatRange(s?.uniform?.start, s?.uniform?.end);
  const dayText = formatDays(days);
  return range ? `${dayText} ${range}` : dayText;
}

/* ---------- Sorting helpers ---------- */
function isHHMM(v: any): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}
function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}
function earliestStartFromSchedule(s: any): number | null {
  if (!s || typeof s !== "object") return null;
  const days: DayKey[] = Array.isArray(s.days)
    ? (s.days.filter((d: any): d is DayKey => ALL_DAYS.includes(d)) as DayKey[])
    : [];

  if (s.mode === "per-day") {
    if (!s.perDay || typeof s.perDay !== "object" || days.length === 0) return null;
    const mins: number[] = [];
    for (const d of days) {
      const start = s.perDay?.[d]?.start;
      if (isHHMM(start)) mins.push(hhmmToMinutes(start));
    }
    return mins.length ? Math.min(...mins) : null;
  }

  const start = s?.uniform?.start;
  return isHHMM(start) ? hhmmToMinutes(start) : null;
}
function compareClasses(a: Klass, b: Klass): number {
  const aActive = a.isActive !== false;
  const bActive = b.isActive !== false;
  if (aActive !== bActive) return aActive ? -1 : 1;

  if (aActive && bActive) {
    const aStart = earliestStartFromSchedule(a.scheduleJson);
    const bStart = earliestStartFromSchedule(b.scheduleJson);
    const aHas = aStart !== null;
    const bHas = bStart !== null;

    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (aHas && bHas) {
      if (aStart! !== bStart!) return aStart! - bStart!;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  }

  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export default function AllClassesPanel() {
  const router = useRouter();
  const [classes, setClasses] = useState<Klass[]>([]);
  const [name, setName] = useState("");
  const [showCreator, setShowCreator] = useState(false);

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

  async function toggleActive(id: string, nextVal: boolean) {
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: nextVal } : c)));
    try {
      const r = await fetch(`/api/classes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextVal }),
      });
      if (!r.ok) throw new Error(await r.text());
    } catch {
      setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: !nextVal } : c)));
      alert("Failed to update class status. Please try again.");
    }
  }

  const sortedClasses = useMemo(() => [...classes].sort(compareClasses), [classes]);

  return (
    <section className="w-96 bg-white border-r overflow-y-auto flex flex-col">
      {/* Header row: EXACTLY like LectureList (flex + justify-between) */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold text-black">
          All Classes ({sortedClasses.length})
        </h2>

        <button
          type="button"
          onClick={() => setShowCreator((v) => !v)}
          aria-expanded={showCreator}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-100 inline-flex items-center gap-2"
        >
          <span>Add class</span>
          <img
            src={showCreator ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
            alt=""
            className="w-4 h-4"
          />
        </button>
      </div>

      {/* Add-class panel (below header) */}
      {showCreator && (
        <div className="p-4 border-b">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
              placeholder="New class name…"
              className="border rounded-lg px-3 py-2 w-full text-black placeholder:text-gray-500 bg-white"
            />
            <button
              type="button"
              onClick={create}
              className="px-4 py-2 rounded-lg bg-black text-white"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* CLASS CARDS — unchanged */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sortedClasses.map((c) => {
          const isSynced = !!c.syncKey;
          const active = c.isActive ?? true;
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
              {/* Left: content (clickable) */}
              <a className="flex-1 min-w-0 block" href={`/class/${c.id}`}>
                <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {new Date(c.createdAt).toLocaleString()}
                </div>
                {scheduleText && (
                  <div className="text-xs text-gray-700 mt-0.5 truncate">{scheduleText}</div>
                )}
                <div className="text-xs mt-1 text-gray-600 flex gap-2">
                  {active ? (
                    <span className="inline-block rounded-full text-[10px] px-2 py-0.5 bg-green-100 text-green-700 border border-green-200">
                      Active
                    </span>
                  ) : (
                    <span className="inline-block rounded-full text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-200">
                      Inactive
                    </span>
                  )}
                  {isSynced && (
                    <span className="inline-block rounded-full text-[10px] px-2 py-0.5 bg-pink-100 text-pink-700 border border-pink-200">
                      Synced
                    </span>
                  )}
                </div>
              </a>

              {/* Right: actions — unchanged */}
              <div
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => toggleActive(c.id, !active)}
                  className="p-2 rounded hover:bg-white"
                  title={active ? "Mark inactive" : "Mark active"}
                  aria-label={active ? "Mark inactive" : "Mark active"}
                >
                  <img
                    src={active ? "/icons/hexagon-check.svg" : "/icons/hexagon-exclamation.svg"}
                    alt={active ? "Active" : "Inactive"}
                    className="w-4 h-4"
                  />
                </button>

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
