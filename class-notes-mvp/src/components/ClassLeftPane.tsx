"use client";

import Link from "next/link";
import { useState } from "react";
import Uploader from "@/components/Uploader";
import LectureItem from "@/components/LectureItem";

type Lecture = any;

export default function ClassLeftPane({
  classId,
  lectures,
}: {
  classId: string;
  lectures: Lecture[];
}) {
  const [showUploader, setShowUploader] = useState(false);

  return (
    <aside className="w-96 shrink-0 border-r bg-white flex flex-col">
      {/* Back link (unchanged) */}
      <div className="p-4 border-b">
        <Link href="/" className="text-sm text-black hover:underline">
          &larr; Back
        </Link>
      </div>

      {/* Uploader block stays WHERE IT CURRENTLY IS (top), but collapsible via the Items header button */}
      {showUploader && (
        <div className="p-4 border-b">
          <h3 className="font-medium text-black mb-2">Add Material</h3>
          <Uploader
            classId={classId}
            onChanged={() => {
              // Optional: auto-collapse after successful upload
              // setShowUploader(false);
            }}
          />
        </div>
      )}

      {/* Items header + Upload toggle button with chevron */}
      <div className="p-4 border-b flex items-center justify-between">
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

      {/* Items list — render the ORIGINAL LectureItem so its behavior is preserved */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {(!lectures || lectures.length === 0) && (
          <div className="text-sm opacity-70">No items yet.</div>
        )}
        {lectures?.map((l: any) => <LectureItem key={l.id} l={l} />)}
      </div>
    </aside>
  );
}
