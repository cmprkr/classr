"use client";

import Link from "next/link";

type LectureLite = {
  id: string;
  originalName?: string | null;
  createdAt?: string | Date;
};

export default function ClassHomeGrid({
  classId,
  classTitle,
  lectures,
}: {
  classId: string;
  classTitle: string;
  lectures: LectureLite[];
}) {
  return (
    <div className="h-full w-full flex flex-col bg-white">
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Modules</h2>
        <div className="flex gap-3 mb-8">
          <Link
            href={`/class/${classId}?tab=chat`}
            className="rounded-xl border bg-white hover:bg-gray-50 transition flex flex-col items-center justify-center w-48 h-48 p-4"
          >
            <img src="/icons/message-circle-dots.svg" alt="" className="w-8 h-8 opacity-80 mb-2" />
            <div className="text-base font-semibold text-black">Chat</div>
            <div className="text-sm text-gray-600 text-center">Ask about this class</div>
          </Link>

          <Link
            href={`/class/${classId}?record=1`}
            className="rounded-xl border bg-white hover:bg-gray-50 transition flex flex-col items-center justify-center w-48 h-48 p-4"
          >
            <img src="/icons/mic.svg" alt="" className="w-8 h-8 opacity-80 mb-2" />
            <div className="text-base font-semibold text-black">Recording</div>
            <div className="text-sm text-gray-600 text-center">Record audio & create items</div>
          </Link>

          <Link
            href={`/class/${classId}?tab=class`}
            className="rounded-xl border bg-white hover:bg-gray-50 transition flex flex-col items-center justify-center w-48 h-48 p-4"
          >
            <img src="/icons/gear.svg" alt="" className="w-8 h-8 opacity-80 mb-2" />
            <div className="text-base font-semibold text-black">Settings</div>
            <div className="text-sm text-gray-600 text-center">Schedule & sync</div>
          </Link>
        </div>

        <h2 className="text-sm font-medium text-gray-700 mb-3">Your summaries</h2>
        {(!lectures || lectures.length === 0) ? (
          <div className="text-sm text-gray-600 border rounded-xl p-6">
            No lecture items yet. Use <span className="font-medium">Recording</span> or upload to create one.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {lectures.map((l) => (
              <Link
                key={l.id}
                href={`/class/${classId}?view=lecture&lectureId=${encodeURIComponent(l.id)}`}
                className="rounded-xl border bg-white hover:bg-gray-50 transition flex flex-col justify-center items-center w-48 h-48 p-4"
                title="Open summary"
              >
                <div className="text-sm font-semibold text-black truncate w-full text-center">
                  {l.originalName || "Untitled lecture"}
                </div>
                <div className="text-xs text-gray-600 mt-1 text-center">
                  {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : ""}
                </div>
                <div className="mt-2 text-xs text-gray-700 text-center">View summary →</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
