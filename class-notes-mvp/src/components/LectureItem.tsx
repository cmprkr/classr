// components/LectureItem.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import LectureSettingsPanel from "@/components/LectureSettingsPanel";

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
  const ordered = ALL_DAYS.filter((d) => days?.includes(d));
  return ordered.map((d) => DAY_TOKEN[d]).join("");
}
function parseTimeParts(hhmm?: string) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [hh, mm] = hhmm.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const suf = hh < 12 ? "a" : "p";
  const h12 = (hh % 12) || 12;
  const base = mm === 0 ? String(h12) : `${h12}:${String(mm).padStart(2, "0")}`;
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
      const st = perDay?.[d]?.start,
        en = perDay?.[d]?.end;
      const key = `${st ?? ""}|${en ?? ""}`;
      (groups[key] ||= []).push(d);
    }
    const entries = Object.entries(groups).sort((a, b) => {
      const ai = ALL_DAYS.findIndex((d) => groups[a[0]].includes(d));
      const bi = ALL_DAYS.findIndex((d) => groups[b[0]].includes(d));
      return ai - bi;
    });
    return entries
      .map(([key, ds]) => {
        const [st, en] = key.split("|");
        const dayText = formatDays(ds);
        const range = formatRange(st || undefined, en || undefined);
        return range ? `${dayText} ${range}` : dayText;
      })
      .join("; ");
  }
  const range = formatRange(s?.uniform?.start, s?.uniform?.end);
  const dayText = formatDays(days);
  return range ? `${dayText} ${range}` : dayText;
}

export default function LectureItem({
  l,
  classId,
  currentUserId,
  onToggled,
}: {
  l: any;
  classId: string;
  currentUserId?: string;
  onToggled?: (id: string, includeInMemory: boolean) => void | Promise<void>;
}) {
  const router = useRouter();
  const search = useSearchParams();

  const [open, setOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Schedules for metadata view
  const [viewerSchedule, setViewerSchedule] = useState<any | null>(null);     // for owner
  const [uploaderSchedule, setUploaderSchedule] = useState<any | null>(       // for non-owner
    l?.uploaderScheduleJson ?? null
  );
  const [metaLoading, setMetaLoading] = useState(false);

  const isSynced = !!l?.syncKey;
  const isNotOwned = l?.userId && l.userId !== currentUserId;
  const includeInMemory = !!l?.includeInMemory;
  const canEdit = !isSynced || (isSynced && l?.userId && l.userId === currentUserId);

  async function toggleInclude() {
    if (toggling) return;
    setToggling(true);

    try {
      const res = await fetch(`/api/lectures/${l.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeInMemory: !includeInMemory }),
      });

      // Read the body ONCE
      const raw = await res.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        // raw was not JSON; that's fine
      }

      if (!res.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          raw ||
          "Toggle failed";
        throw new Error(msg);
      }

      // Success: use parsed JSON if present
      const updated = data ?? {};
      l.includeInMemory = !!updated.includeInMemory;

      if (onToggled) {
        await onToggled(l.id, !!updated.includeInMemory);
      }
    } catch (e: any) {
      console.error("Toggle failed:", e?.message || e);
    } finally {
      setToggling(false);
    }
  }


  function toggleSettingsInline() {
    setSettingsOpen((v) => !v);
  }

  function openSummaryPage() {
    const params = new URLSearchParams(search?.toString() || "");
    params.set("view", "lecture");
    params.set("lectureId", l.id);
    router.push(`/class/${classId}?${params.toString()}`);
  }

  // Lazy-load schedules when Metadata is first opened
  useEffect(() => {
    let active = true;
    (async () => {
      if (!metadataOpen) return;

      // If owner: fetch this class's schedule
      if (l?.userId && l.userId === currentUserId && viewerSchedule == null) {
        try {
          setMetaLoading(true);
          const r = await fetch(`/api/classes/${classId}`);
          if (r.ok) {
            const data = await r.json();
            if (active) setViewerSchedule(data?.scheduleJson ?? null);
          }
        } catch {
          // ignore
        } finally {
          if (active) setMetaLoading(false);
        }
      }

      // If non-owner: fetch uploader schedule from lecture GET (requires updated API)
      if (l?.userId && l.userId !== currentUserId && uploaderSchedule == null) {
        try {
          setMetaLoading(true);
          const r = await fetch(`/api/lectures/${l.id}`);
          if (r.ok) {
            const data = await r.json();
            if (active) setUploaderSchedule(data?.uploaderScheduleJson ?? null);
          }
        } catch {
          // ignore
        } finally {
          if (active) setMetaLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [metadataOpen, classId, currentUserId, l?.id, l?.userId, viewerSchedule, uploaderSchedule]);

  const scheduleSource =
    l?.uploaderScheduleJson ??
    (l?.userId === currentUserId ? viewerSchedule : uploaderSchedule);
  const scheduleText = formatSchedule(scheduleSource);

  const uploadedAt =
    l?.createdAt && !isNaN(Date.parse(l.createdAt))
      ? new Date(l.createdAt)
      : l?.uploadedAt && !isNaN(Date.parse(l.uploadedAt))
      ? new Date(l.uploadedAt)
      : null;

  const cardBase =
    "p-3 rounded-lg border flex items-start justify-between gap-3 cursor-pointer";
  const syncedBg =
    "bg-gradient-to-r from-indigo-50 via-fuchsia-50 to-pink-50 hover:from-indigo-100 hover:via-fuchsia-100 hover:to-pink-100 border-fuchsia-200";
  const normalBg = "bg-gray-50 hover:bg-gray-100";

  return (
    <div className="rounded-lg overflow-hidden">
      <div
        className={`${cardBase} ${isSynced ? syncedBg : normalBg}`}
        onClick={openSummaryPage}
        title={isSynced ? "Synced item" : undefined}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate text-gray-900">
            {l.originalName}
          </div>
          <div className="text-xs mt-1 text-gray-600">
            {(l.kind ?? "OTHER")} • Status: {l.status}
            {l.durationSec ? ` • ${l.durationSec}s` : ""}
          </div>
          {(isSynced || isNotOwned) && (
            <div className="text-xs mt-1 text-gray-600 flex gap-2">
              {isSynced && (
                <span className="inline-block rounded-full text-[10px] px-2 py-0.5 bg-pink-100 text-pink-700 border border-pink-200">
                  Synced
                </span>
              )}
              {isNotOwned && (
                <span className="inline-block rounded-full text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-200">
                  Imported
                </span>
              )}
            </div>
          )}
        </div>
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={toggleInclude}
            disabled={toggling}
            className={`p-2 rounded hover:bg-white ${toggling ? "opacity-60" : ""}`}
            title={
              includeInMemory
                ? "Included in AI memory (click to exclude)"
                : "Excluded from AI memory (click to include)"
            }
          >
            <img
              src={includeInMemory ? "/icons/eye.svg" : "/icons/eye-slash.svg"}
              alt={includeInMemory ? "Included" : "Excluded"}
              className="w-4 h-4"
            />
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className={`p-2 rounded hover:bg-white ${settingsOpen ? "bg-white" : ""}`}
              title={settingsOpen ? "Hide lecture settings" : "Lecture settings"}
            >
              <img src="/icons/gear.svg" alt="Settings" className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="p-2 rounded hover:bg-white"
            title={open ? "Collapse details" : "Expand details"}
          >
            <img
              src={open ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
              alt=""
              className="w-4 h-4"
            />
          </button>
        </div>
      </div>

      {/* Inline lecture settings */}
      {settingsOpen && (
        <div
          className={`border-x border-b p-3 ${isSynced ? syncedBg : normalBg}`}
          onClick={(e) => e.stopPropagation()}
        >
          <LectureSettingsPanel
            lectureId={l.id}
            onClose={() => setSettingsOpen(false)}
            embedded
          />
        </div>
      )}

      {/* Expand details */}
      {open && (
        <div
          className={`border-x border-b p-3 space-y-2 ${isSynced ? syncedBg : normalBg}`}
          onClick={(e) => e.stopPropagation()}
        >
          {l.summaryJson && (
            <div>
              <button
                onClick={() => setSummaryOpen((o) => !o)}
                className="flex items-center gap-2 text-sm font-medium text-black"
              >
                <img
                  src={summaryOpen ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
                  alt=""
                  className="w-4 h-4"
                />
                Summary
              </button>
              {summaryOpen && (
                <pre className="whitespace-pre-wrap text-sm text-black mt-2 bg-gray-50 p-2 rounded max-h-72 overflow-auto">
                  {l.summaryJson}
                </pre>
              )}
            </div>
          )}

          {(l.transcript || l.textContent) && (
            <div>
              <button
                onClick={() => setTranscriptOpen((o) => !o)}
                className="flex items-center gap-2 text-sm font-medium text-black"
              >
                <img
                  src={transcriptOpen ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
                  alt=""
                  className="w-4 h-4"
                />
                Transcript / Text
              </button>
              {transcriptOpen && (
                <pre className="whitespace-pre-wrap text-sm text-black mt-2 bg-gray-50 p-2 rounded max-h-72 overflow-auto">
                  {l.transcript || l.textContent}
                </pre>
              )}
            </div>
          )}

          {/* Metadata */}
          <div>
            <button
              onClick={() => setMetadataOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-medium text-black"
            >
              <img
                src={metadataOpen ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
                alt=""
                className="w-4 h-4"
              />
              Metadata
            </button>

            {metadataOpen && (
              <div className="mt-2 text-sm text-black space-y-1">
                <div>
                  <span className="font-medium">Uploaded:</span>{" "}
                  {uploadedAt ? uploadedAt.toLocaleString() : "—"}
                </div>
                <div>
                  <span className="font-medium">Schedule:</span>{" "}
                  {metaLoading ? "Loading…" : scheduleText || "—"}
                </div>
              </div>
            )}
          </div>

          {!l.summaryJson && !l.transcript && !l.textContent && (
            <div className="text-xs text-gray-500">No preview available.</div>
          )}
        </div>
      )}
    </div>
  );
}
