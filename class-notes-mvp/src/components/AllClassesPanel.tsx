// src/components/AllClassesPanel.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Klass = {
  id: string;
  name: string;
  createdAt: string;
  syncKey?: string | null;
  scheduleJson?: any | null; // must be returned by /api/classes
  isActive?: boolean;        // ✅ new: used for the Active/Inactive tag
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
          const active = c.isActive ?? true; // default to active if undefined
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
                {/* Row 1: title only */}
                <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>

                {/* Row 2: created date */}
                <div className="text-xs text-gray-600 mt-1">
                  {new Date(c.createdAt).toLocaleString()}
                </div>

                {/* Row 3: schedule (if any) */}
                {scheduleText && (
                  <div className="text-xs text-gray-700 mt-0.5 truncate">{scheduleText}</div>
                )}

                {/* Row 4: badges (Active/Inactive first, then Synced) */}
                <div className="text-xs mt-1 text-gray-600 flex gap-2">
                  {/* Active/Inactive (leftmost) */}
                  {active ? (
                    <span className="inline-block rounded-full text-[10px] px-2 py-0.5 bg-green-100 text-green-700 border border-green-200">
                      Active
                    </span>
                  ) : (
                    <span className="inline-block rounded-full text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-200">
                      Inactive
                    </span>
                  )}

                  {/* Synced tag (optional) */}
                  {isSynced && (
                    <span className="inline-block rounded-full text-[10px] px-2 py-0.5 bg-pink-100 text-pink-700 border border-pink-200">
                      Synced
                    </span>
                  )}
                </div>
              </a>

              {/* Right: actions */}
              <div
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
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
