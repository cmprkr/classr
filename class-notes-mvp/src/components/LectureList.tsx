"use client";
import LectureItem from "@/components/LectureItem";
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
  includeInMemory?: boolean | null;
};

export default function LectureList({
  lectures,
  classId,
}: {
  lectures: Lecture[];
  classId: string;
}) {
  // This component now ONLY renders the uploader and a list of LectureItem rows.
  // The expand/collapse + settings nav behavior lives in LectureItem.
  return (
    <div className="rounded-2xl border bg-white">
      {/* Header row: "Items" (no in-place uploader toggle here; keep simple) */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-sm font-semibold text-black">Items</h2>
      </div>

      {/* Optional uploader at top; keep if you want it here (or remove if moving to ClassLeftPane) */}
      {/* <div className="p-4 border-b">
        <Uploader classId={classId} onChanged={() => {}} />
      </div> */}

      {/* Items list */}
      <ul className="p-4 space-y-2">
        {(!lectures || lectures.length === 0) && (
          <li className="text-sm text-gray-500">No items yet.</li>
        )}

        {lectures?.map((l) => (
          <li key={l.id} className="rounded-lg border">
            <LectureItem
              l={l}
              classId={classId}
              // Optionally wire deletes/toggles to refresh list here:
              // onDelete={async (id) => { await fetch(`/api/lectures/${id}`, { method: "DELETE" }); refetch(); }}
              // onToggled={async () => { refetch(); }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
