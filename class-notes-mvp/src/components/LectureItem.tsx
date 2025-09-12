"use client";

import { useState } from "react";

export default function LectureItem({ l }: { l: any }) {
  const [open, setOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  return (
    <div className="p-3 bg-gray-50 rounded-lg border hover:bg-gray-100">
      {/* Outer header for the lecture item */}
      <div
        className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate text-gray-900">
            {l.originalName}
          </div>
          <div className="text-xs mt-1 text-gray-600">
            {(l.kind ?? "OTHER")} • Status: {l.status}
            {l.durationSec ? ` • ${l.durationSec}s` : ""}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div
          className="border-t p-3 space-y-2 bg-white"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Summary block */}
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

          {/* Transcript / Text block */}
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

          {/* If no preview available */}
          {!l.summaryJson && !l.transcript && !l.textContent && (
            <div className="text-xs text-gray-500">No preview available.</div>
          )}
        </div>
      )}
    </div>
  );
}
