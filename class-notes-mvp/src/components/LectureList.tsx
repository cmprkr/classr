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
  const [openId, setOpenId] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);

  return (
    <div className="rounded-2xl border bg-white">
      {/* Header row: "Items" + Upload toggle */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-sm font-semibold text-black">Items</h2>
        <button
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

      {/* Collapsible uploader panel */}
      {showUploader && (
        <div className="p-4 border-b">
          <Uploader
            classId={classId}
            onChanged={() => {
              // collapse uploader after successful upload if you want:
              // setShowUploader(false);
            }}
          />
        </div>
      )}

      {/* Items list */}
      <ul className="p-4 space-y-2">
        {(lectures || []).map((l) => {
          const open = openId === l.id;
          return (
            <li key={l.id} className="rounded-lg border">
              <button
                onClick={() => setOpenId(open ? null : l.id)}
                className="w-full text-left p-3 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-black">
                    {l.originalName}
                  </div>
                  <div className="text-xs text-black mt-1">
                    {(l.kind ?? "OTHER")} · Status: {l.status}
                    {l.durationSec ? ` · ${l.durationSec}s` : ""}
                  </div>
                </div>
                <span className="text-black text-sm">{open ? "▲" : "▼"}</span>
              </button>

              {open && (
                <div className="border-t p-3 space-y-4 bg-gray-50">
                  {l.summaryJson && (
                    <div>
                      <div className="font-medium text-black mb-1">Summary</div>
                      <pre className="whitespace-pre-wrap text-black text-sm bg-white rounded p-2">
                        {l.summaryJson}
                      </pre>
                    </div>
                  )}
                  {(l.transcript || l.textContent) && (
                    <div>
                      <div className="font-medium text-black mb-1">Transcript / Text</div>
                      <pre className="whitespace-pre-wrap text-black text-sm bg-white rounded p-2 max-h-72 overflow-auto">
                        {l.transcript || l.textContent}
                      </pre>
                    </div>
                  )}
                  {!l.summaryJson && !l.transcript && !l.textContent && (
                    <div className="text-xs text-gray-500">
                      No preview available.
                    </div>
                  )}
                </div>
              )}
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
