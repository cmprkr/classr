// components/LectureList.tsx
"use client";
import { useState } from "react";

type Lecture = {
  id: string;
  originalName: string;
  status: string;
  durationSec: number | null;
  summaryJson: string | null;   // may be plain text; we show as-is
  transcript: string | null;
};

export default function LectureList({ lectures }: { lectures: Lecture[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border bg-white p-4">
      <h2 className="font-medium mb-2 text-black">Lectures</h2>
      <ul className="space-y-2">
        {(lectures || []).map((l) => {
          const open = openId === l.id;
          return (
            <li key={l.id} className="rounded-lg border">
              <button
                onClick={() => setOpenId(open ? null : l.id)}
                className="w-full text-left p-3 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-black">{l.originalName}</div>
                  <div className="text-xs text-black">
                    Status: {l.status}
                    {l.status === "READY" && ` · Duration: ${l.durationSec ?? "?"}s`}
                  </div>
                </div>
                <span className="text-black text-sm">{open ? "▲" : "▼"}</span>
              </button>

              {open && (
                <div className="border-t p-3 space-y-4">
                  <div>
                    <div className="font-medium text-black mb-1">Summary</div>
                    <pre className="whitespace-pre-wrap text-black text-sm bg-gray-50 rounded p-2">
                      {l.summaryJson || "No summary available."}
                    </pre>
                  </div>
                  <div>
                    <div className="font-medium text-black mb-1">Transcript</div>
                    <pre className="whitespace-pre-wrap text-black text-sm bg-gray-50 rounded p-2 max-h-72 overflow-auto">
                      {l.transcript || "No transcript stored."}
                    </pre>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
