// src/components/ClassLeftPane.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Uploader from "@/components/Uploader";
import LectureItem from "@/components/LectureItem";

type Lecture = {
  id: string;
  classId: string;
  userId?: string | null;
  originalName: string;
  status: string;
  durationSec?: number | null;
  kind?: string | null;
  summaryJson?: string | null;
  transcript?: string | null;
  textContent?: string | null;
  includeInMemory?: boolean | null; // legacy
  syncKey?: string | null;
  createdAt?: string | Date | null;
  userPrefs?: { includeInAISummary?: boolean | null }[];
  viewerIncludeInAISummary?: boolean;
};

type FilterMode =
  | "all"
  | "mine"
  | "same-period"
  | "active-class"
  | "since-date";

type LectureMetaCache = {
  uploaderId?: string | null;
  uploaderScheduleJson?: any | null;
  classIsActive?: boolean | null;
};

export default function ClassLeftPane({
  classId,
  lectures,
  currentUserId,
}: {
  classId: string;
  lectures: Lecture[];
  currentUserId: string;
}) {
  const [showUploader, setShowUploader] = useState(false);

  // ---- Filter state
  const [mode, setMode] = useState<FilterMode>("all");
  const [sinceDate, setSinceDate] = useState<string>("");

  // Popover for filters (opened by the Items button)
  const [showFilterUI, setShowFilterUI] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const filterPopRef = useRef<HTMLDivElement | null>(null);

  // Close popover on outside click / Esc
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        showFilterUI &&
        filterPopRef.current &&
        !filterPopRef.current.contains(t) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(t)
      ) {
        setShowFilterUI(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setShowFilterUI(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [showFilterUI]);

  // ---- Viewer schedule for "same-period"
  const [viewerSchedule, setViewerSchedule] = useState<any | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/classes/${classId}`);
        if (!r.ok) return;
        const data = await r.json();
        if (alive) setViewerSchedule(data?.scheduleJson ?? null);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [classId]);

  // ---- Metadata + prefs caches
  const metaCache = useRef<Map<string, LectureMetaCache>>(new Map());
  async function ensureMeta(lectureId: string): Promise<LectureMetaCache> {
    const hit = metaCache.current.get(lectureId);
    if (hit) return hit;
    const r = await fetch(`/api/lectures/${lectureId}`);
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    const packed: LectureMetaCache = {
      uploaderId: data?.uploader?.id ?? data?.user?.id ?? null,
      uploaderScheduleJson: data?.uploaderScheduleJson ?? null,
      classIsActive: data?.clazzIsActive ?? null, // exposed by GET /api/lectures/[id]
    };
    metaCache.current.set(lectureId, packed);
    return packed;
    // Note: /api/lectures/[id] GET must include clazz.isActive as clazzIsActive
  }

  const prefCache = useRef<Map<string, boolean>>(new Map());
  const originalBeforeFilter = useRef<Map<string, boolean>>(new Map());

  async function getPref(lectureId: string): Promise<boolean> {
    const v = prefCache.current.get(lectureId);
    if (typeof v === "boolean") return v;
    try {
      const r = await fetch(`/api/lectures/${lectureId}/preference`);
      const data = r.ok ? await r.json() : { includeInAISummary: true };
      const flag = Boolean(data?.includeInAISummary ?? true);
      prefCache.current.set(lectureId, flag);
      return flag;
    } catch {
      prefCache.current.set(lectureId, true);
      return true;
    }
  }

  async function setPref(lectureId: string, next: boolean) {
    const res = await fetch(`/api/lectures/${lectureId}/preference`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeInAISummary: next }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json().catch(() => ({}));
    const saved = Boolean(data?.includeInAISummary ?? next);
    prefCache.current.set(lectureId, saved);
  }

  async function handleChildToggled(id: string, include: boolean) {
    prefCache.current.set(id, include);
    if (!originalBeforeFilter.current.has(id)) {
      originalBeforeFilter.current.set(id, include);
    }
  }

  const [filtering, setFiltering] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => new Set((lectures || []).map((l) => l.id))
  );

  async function applyFilter(nextMode = mode, nextSinceDate = sinceDate) {
    setFiltering(true);
    const nextVisible = new Set<string>();

    for (const l of lectures || []) {
      const id = l.id;
      let show = true;

      if (nextMode === "mine") {
        show = l.userId === currentUserId;
      } else if (nextMode === "same-period") {
        const meta = await ensureMeta(id);
        const a = JSON.stringify(viewerSchedule ?? null);
        const b = JSON.stringify(meta.uploaderScheduleJson ?? null);
        show = a === b;
      } else if (nextMode === "active-class") {
        const meta = await ensureMeta(id);
        show = Boolean(meta.classIsActive);
      } else if (nextMode === "since-date") {
        if (!nextSinceDate) {
          show = true;
        } else {
          const dt = new Date(nextSinceDate);
          const createdRaw =
            (l.createdAt && new Date(l.createdAt)) ||
            (typeof (l as any).uploadedAt === "string"
              ? new Date((l as any).uploadedAt)
              : null);
          show = createdRaw ? createdRaw >= dt : true;
        }
      } else {
        show = true;
      }

      if (show) nextVisible.add(id);
    }

    const nowHidden = (lectures || [])
      .map((x) => x.id)
      .filter((id) => !nextVisible.has(id));
    const nowShown = Array.from(nextVisible);

    for (const id of nowHidden) {
      const current = await getPref(id);
      if (!originalBeforeFilter.current.has(id)) {
        originalBeforeFilter.current.set(id, current);
      }
      if (current !== false) {
        try {
          await setPref(id, false);
        } catch (e) {
          console.error("Failed to exclude", id, e);
        }
      }
    }

    for (const id of nowShown) {
      if (originalBeforeFilter.current.has(id)) {
        const original = originalBeforeFilter.current.get(id)!;
        const current = await getPref(id);
        if (current !== original) {
          try {
            await setPref(id, original);
          } catch (e) {
            console.error("Failed to restore", id, e);
          }
        }
        if (nextMode === "all" || nextVisible.has(id)) {
          originalBeforeFilter.current.delete(id);
        }
      }
    }

    setVisibleIds(nextVisible);
    setFiltering(false);
  }

  useEffect(() => {
    applyFilter().catch(() => setFiltering(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sinceDate, lectures, viewerSchedule]);

  const visibleLectures = useMemo(
    () => (lectures || []).filter((l) => visibleIds.has(l.id)),
    [lectures, visibleIds]
  );

  return (
    <aside className="w-96 shrink-0 border-r bg-white flex flex-col">
      {/* Back link */}
      <div className="p-4 border-b">
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-100"
        >
          Back
        </Link>
      </div>

      {/* Header row */}
      <div className="p-4 border-b flex items-center justify-between relative">
        {/* ITEMS -> button (opens filter popover) */}
        <button
          ref={filterBtnRef}
          type="button"
          className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-100"
          onClick={() => setShowFilterUI((v) => !v)}
          aria-expanded={showFilterUI}
          aria-haspopup="dialog"
          title="Filter items"
        >
          Filters
          <img
            src={showFilterUI ? "/icons/chevron-up.svg" : "/icons/chevron-down.svg"}
            alt=""
            className="w-4 h-4 ml-2"
            aria-hidden="true"
          />
        </button>

        {/* Upload icon button */}
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-100"
          onClick={() => setShowUploader((v) => !v)}
          aria-expanded={showUploader}
          aria-label={showUploader ? "Hide uploader" : "Show uploader"}
          title={showUploader ? "Hide uploader" : "Show uploader"}
        >
          <img
            src="/icons/file-arrow-up.svg"
            alt=""
            className="w-4 h-4"
            aria-hidden="true"
          />
        </button>

        {/* Popover: positioned just to the right of the Items button */}
        {showFilterUI && (
          <div
            ref={filterPopRef}
            className="absolute left-1/2 top-full mt-2 z-10 
                      -translate-x-1/2 bg-white border rounded-xl shadow-lg 
                      p-3 w-[min(320px,calc(100%-1rem))]"
            role="dialog"
            aria-label="Filter items"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label htmlFor="filterMode" className="text-xs text-gray-600 min-w-[88px]">
                  Show:
                </label>
                <select
                  id="filterMode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as FilterMode)}
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1 text-gray-800 hover:bg-gray-50"
                >
                  <option value="all">All items</option>
                  <option value="mine">My uploads</option>
                  <option value="same-period">Same class period</option>
                  <option value="active-class">From active classes</option>
                  <option value="since-date">Since date…</option>
                </select>
              </div>

              {mode === "since-date" && (
                <div className="flex items-center gap-2">
                  <label htmlFor="sinceDate" className="text-xs text-gray-600 min-w-[88px]">
                    Date:
                  </label>
                  <input
                    id="sinceDate"
                    type="date"
                    value={sinceDate}
                    onChange={(e) => setSinceDate(e.target.value)}
                    className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1 text-gray-800"
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setMode("all");
                    setSinceDate("");
                    setShowFilterUI(false);
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-900 text-white bg-black hover:opacity-90"
                  onClick={() => setShowFilterUI(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Uploader panel */}
      {showUploader && (
        <div className="p-4 border-b">
          <Uploader
            classId={classId}
            onChanged={() => {
              // optionally auto-collapse after a successful upload:
              // setShowUploader(false);
            }}
          />
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtering && (
          <div className="text-xs text-gray-500">Applying filter…</div>
        )}
        {visibleLectures.length === 0 ? (
          <div className="text-sm opacity-70">No items match this filter.</div>
        ) : (
          visibleLectures.map((l: any) => (
            <LectureItem
              key={l.id}
              l={l}
              classId={classId}
              currentUserId={currentUserId}
              onToggled={handleChildToggled}
            />
          ))
        )}
      </div>
    </aside>
  );
}
