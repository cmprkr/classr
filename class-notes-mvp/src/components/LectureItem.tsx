// src/components/LectureItem.tsx
"use client";

import { useState } from "react";

export default function LectureItem({
  l,
  onDelete,
  onToggled, // optional: parent can refetch after toggle
}: {
  l: any;
  onDelete?: (id: string) => Promise<void> | void;
  onToggled?: (id: string, includeInMemory: boolean) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [includeInMemory, setIncludeInMemory] = useState<boolean>(
    l?.includeInMemory ?? true
  );
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this lecture?")) return;
    if (onDelete) {
      await onDelete(l.id);
    } else {
      await fetch(`/api/lectures/${l.id}`, { method: "DELETE" });
      // parent should re-fetch after deletion
    }
  }

  async function toggleInclude() {
    if (busy) return;
    setBusy(true);
    try {
      const next = !includeInMemory;
      const r = await fetch(`/api/lectures/${l.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeInMemory: next }),
      });
      if (r.ok) {
        setIncludeInMemory(next);
        onToggled?.(l.id, next);
      } else {
        const err = await r.json().catch(() => ({}));
        alert(err?.error || "Failed to update setting");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-3 bg-gray-50 rounded-lg border hover:bg-gray-100">
      {/* Header: left info, right actions */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: clickable info to expand/collapse */}
        <button
          type="button"
          className="flex-1 text-left cursor-pointer"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`lecture-${l.id}`}
        >
          <div className="text-sm font-semibold truncate text-gray-900">
            {l.originalName}
          </div>
          <div className="text-xs mt-1 text-gray-600">
            {(l.kind ?? "OTHER")} • Status: {l.status}
            {l.durationSec ? ` • ${l.durationSec}s` : ""}
          </div>
        </button>

        {/* Right: eye toggle (include) + delete; consistent position */}
        <div className="flex items-center gap-2 flex-none">
          {/* Include-in-memory toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleInclude();
            }}
            className="p-2 rounded hover:bg-white"
            aria-pressed={includeInMemory}
            title={
              includeInMemory
                ? "Included in AI memory (click to exclude)"
                : "Excluded from AI memory (click to include)"
            }
            disabled={busy}
          >
            <img
              src={includeInMemory ? "/icons/eye.svg" : "/icons/eye-slash.svg"}
              alt={includeInMemory ? "Included" : "Excluded"}
              className="w-4 h-4"
            />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="p-2 rounded hover:bg-white"
            title="Delete lecture"
          >
            <img src="/icons/trash.svg" alt="Delete" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div
          id={`lecture-${l.id}`}
          className="border-t p-3 space-y-2 bg-white mt-3"
          onClick={(e) => e.stopPropagation()}
        >
          {l.summaryJson && (
            <div>
              <button
                onClick={() => setSummaryOpen((o) => !o)}
                className="flex items-center gap-2 text-sm font-medium text-black"
                type="button"
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
                type="button"
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
