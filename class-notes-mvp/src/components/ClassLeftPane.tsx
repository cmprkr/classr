//src/components/ClassLeftPane.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import Uploader from "@/components/Uploader";
import LectureItem from "@/components/LectureItem";

type Lecture = any;

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

  return (
    <aside className="w-96 shrink-0 border-r bg-white flex flex-col">
      {/* Back link */}
      <div className="p-4 border-b">
        <Link href="/" className="text-sm text-black hover:underline">
          &larr; Back
        </Link>
      </div>

      {/* Uploader (collapsible) */}
      {showUploader && (
        <div className="p-4 border-b">
          <h3 className="font-medium text-black mb-2">Add Material</h3>
          <Uploader
            classId={classId}
            onChanged={() => {
              // optionally auto-collapse after a successful upload
              // setShowUploader(false);
            }}
          />
        </div>
      )}

      {/* Items header + Upload toggle button */}
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

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {(!lectures || lectures.length === 0) && (
          <div className="text-sm opacity-70">No items yet.</div>
        )}
        {lectures?.map((l: any) => (
          <LectureItem
            key={l.id}
            l={l}
            classId={classId}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </aside>
  );
}
