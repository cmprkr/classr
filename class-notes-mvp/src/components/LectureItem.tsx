"use client";

import { useState } from "react";

export default function LectureItem({ l }: { l: any }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-lg border hover:bg-gray-50 transition cursor-pointer text-black"
      onClick={() => setOpen((v) => !v)}
    >
      <div className="p-3">
        <div className="text-sm font-semibold truncate">{l.originalName}</div>
        <div className="text-xs mt-1">
          {(l.kind ?? "OTHER")} • Status: {l.status}
          {l.durationSec ? ` • ${l.durationSec}s` : ""}
        </div>
      </div>

      {open && (
        <div className="border-t p-3 space-y-2 bg-white">
          {l.summaryJson && (
            <details className="rounded bg-gray-50 p-2" open>
              <summary className="cursor-pointer font-medium text-sm text-black">
                Summary
              </summary>
              <pre className="whitespace-pre-wrap text-sm text-black">
                {l.summaryJson}
              </pre>
            </details>
          )}
          {(l.transcript || l.textContent) && (
            <details className="rounded bg-gray-50 p-2">
              <summary className="cursor-pointer font-medium text-sm text-black">
                Transcript / Text
              </summary>
              <pre className="whitespace-pre-wrap text-sm text-black">
                {l.transcript || l.textContent}
              </pre>
            </details>
          )}
          {!l.summaryJson && !l.transcript && !l.textContent && (
            <div className="text-xs">No preview available.</div>
          )}
        </div>
      )}
    </div>
  );
}
