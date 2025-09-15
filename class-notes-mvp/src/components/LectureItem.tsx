// src/components/LectureItem.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LectureItem({
  l,
  classId,
  currentUserId,
  onDelete,
  onToggled,
}: {
  l: any;
  classId: string;
  currentUserId?: string;
  onDelete?: (id: string) => void | Promise<void>;
  onToggled?: (id: string, includeInMemory: boolean) => void | Promise<void>;
}) {
  const router = useRouter();
  const search = useSearchParams();

  const [open, setOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isSynced = !!l?.syncKey;
  const isNotOwned = l?.userId && l.userId !== currentUserId;
  const includeInMemory = !!l?.includeInMemory;
  const canDelete = !isSynced || (isSynced && l?.userId && l.userId === currentUserId);

  async function toggleInclude() {
    if (toggling) return;
    setToggling(true);
    try {
      console.log("Toggling lecture:", { id: l.id, classId: l.classId, userId: l.userId, syncKey: l.syncKey, includeInMemory });
      const res = await fetch(`/api/lectures/${l.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeInMemory: !includeInMemory }),
      });
      if (!res.ok) {
        let error = "Toggle failed";
        try {
          const errorData = await res.json();
          error = errorData.error || error;
        } catch {
          console.error("Response body invalid:", await res.text());
        }
        throw new Error(error);
      }
      const updated = await res.json();
      console.log("Toggle response:", updated);
      l.includeInMemory = updated.includeInMemory;
      if (onToggled) await onToggled(l.id, updated.includeInMemory);
    } catch (e: any) {
      console.error("Toggle failed:", e.message);
    } finally {
      setToggling(false);
    }
  }

  async function remove() {
    if (deleting) return;
    if (!confirm("Delete this item? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/lectures/${l.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      if (onDelete) await onDelete(l.id);
    } catch (e: any) {
      console.error("Delete failed:", e.message);
    } finally {
      setDeleting(false);
    }
  }

  function openSettingsPanel() {
    const params = new URLSearchParams(search?.toString() || "");
    params.set("tab", "class");
    params.set("lectureId", l.id);
    router.push(`/class/${classId}?${params.toString()}`);
  }

  const cardBase =
    "p-3 rounded-lg border flex items-start justify-between gap-3 cursor-pointer";
  const syncedBg =
    "bg-gradient-to-r from-indigo-50 via-fuchsia-50 to-pink-50 hover:from-indigo-100 hover:via-fuchsia-100 hover:to-pink-100 border-fuchsia-200";
  const normalBg = "bg-gray-50 hover:bg-gray-100";

  return (
    <div className="rounded-lg overflow-hidden">
      <div
        className={`${cardBase} ${isSynced ? syncedBg : normalBg}`}
        onClick={openSettingsPanel}
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

          {canDelete && (
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className={`p-2 rounded hover:bg-white ${deleting ? "opacity-60" : ""}`}
              title="Delete item"
            >
              <img src="/icons/trash.svg" alt="Delete" className="w-4 h-4" />
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

          {!l.summaryJson && !l.transcript && !l.textContent && (
            <div className="text-xs text-gray-500">No preview available.</div>
          )}
        </div>
      )}
    </div>
  );
}