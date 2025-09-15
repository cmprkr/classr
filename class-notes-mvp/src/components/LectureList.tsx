// src/components/LectureList.tsx
"use client";
import { useState } from "react";
import Uploader from "@/components/Uploader";

type Lecture = {
  id: string;
  originalName: string;
  kind?: string | null;
  status: string;
  durationSec?: number | null;
  summaryJson?: string | null;
  transcript?: string | null;
  textContent?: string | null;
};

export default function LectureList({
  lectures,
  classId,
}: {
  lectures: Lecture[];
  classId: string;
}) {
  const [showUploader, setShowUploader] = useState(false);

  return (
    <div className="rounded-2xl border bg-white">
      {/* Header row: "Items" + Upload toggle */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-sm font-semibold text-black">Items</h2>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-gray-800 hover:text-black"
          onClick={() => setShowUploader((v) => !v)}
          aria-expanded={showUploader}
        >
          <span>Upload file</span>
          <img
            src={showUploader ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
            alt=""
            className="w-4 h-4"
          />
        </button>
      </div>

      {/* ⬇️ Uploader panel sits directly UNDER the header (never above) */}
      {showUploader && (
        <div className="p-4 border-b">
          <Uploader
            classId={classId}
            onChanged={() => {
              // optionally auto-collapse after successful upload:
              // setShowUploader(false);
            }}
          />
        </div>
      )}

      {/* Items list */}
      <ul className="p-4 space-y-2">
        {(lectures || []).map((l) => {
          return (
            <li key={l.id} className="rounded-lg border">
              {/* Keep simple, non-collapsing row (collapsing handled per your LectureItem if you use it) */}
              <div className="w-full p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-black truncate">
                    {l.originalName}
                  </div>
                  <div className="text-xs text-black mt-1">
                    {(l.kind ?? "OTHER")} · Status: {l.status}
                    {l.durationSec ? ` · ${l.durationSec}s` : ""}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {(!lectures || lectures.length === 0) && (
          <li className="text-sm text-gray-500">No items yet.</li>
        )}
      </ul>
    </div>
  );
}
