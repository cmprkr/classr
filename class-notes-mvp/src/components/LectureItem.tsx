"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LectureItem({
  l,
  classId,
  onDelete,
  onToggled,
}: {
  l: any;
  classId: string;
  onDelete?: (id: string) => Promise<void> | void;
  onToggled?: (id: string, includeInMemory: boolean) => Promise<void> | void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [includeInMemory, setIncludeInMemory] = useState<boolean>(l?.includeInMemory ?? true);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this lecture?")) return;
    if (onDelete) {
      await onDelete(l.id);
    } else {
      await fetch(`/api/lectures/${l.id}`, { method: "DELETE" });
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

  // Clicking the CARD (not the action buttons) opens the settings view in the right pane.
  function openSettings() {
    router.push(`/class/${classId}?lecture=${encodeURIComponent(l.id)}`);
  }

  return (
    <div
      className="p-3 bg-gray-50 rounded-lg border hover:bg-gray-100"
      onClick={openSettings}
      role="button"
    >
      {/* Header: left text, right actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate text-gray-900">{l.originalName}</div>
          <div className="text-xs mt-1 text-gray-600">
            {(l.kind ?? "OTHER")} • Status: {l.status}
            {l.durationSec ? ` • ${l.durationSec}s` : ""}
          </div>
        </div>

        {/* Actions: eye • trash • chevron */}
        <div className="flex items-center gap-2 flex-none" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={toggleInclude}
            className="p-2 rounded hover:bg-white"
            aria-pressed={includeInMemory}
            title={includeInMemory ? "Included in AI memory (click to exclude)" : "Excluded from AI memory (click to include)"}
            disabled={busy}
          >
            <img
              src={includeInMemory ? "/icons/eye.svg" : "/icons/eye-slash.svg"}
              alt={includeInMemory ? "Included" : "Excluded"}
              className="w-4 h-4"
            />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="p-2 rounded hover:bg-white"
            title="Delete lecture"
          >
            <img src="/icons/trash.svg" alt="Delete" className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="p-2 rounded hover:bg-white"
            title={open ? "Collapse" : "Expand"}
          >
            <img
              src={open ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
              alt=""
              className="w-4 h-4"
            />
          </button>
        </div>
      </div>

      {/* Expanded content (opened by chevron only) */}
      {open && (
        <div className="border-t p-3 space-y-2 bg-white mt-3" onClick={(e) => e.stopPropagation()}>
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
