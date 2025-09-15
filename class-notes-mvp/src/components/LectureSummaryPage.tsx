// components/LectureSummaryPage.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

type Lecture = {
  id: string;
  originalName: string;
  summaryJson?: string | null;
  classId?: string;
};

export default function LectureSummaryPage({ lectureId, classId }: { lectureId: string; classId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const r = await fetch(`/api/lectures/${lectureId}`);
        if (!r.ok) throw new Error((await r.text()) || "Failed to load lecture");
        const data = await r.json();
        if (mounted) {
          setLecture({
            id: data.id,
            originalName: data.originalName || "",
            summaryJson: data.summaryJson || data.summary || "",
            classId: data.classId || classId,
          });
        }
      } catch (e: any) {
        if (mounted) setError(`Failed to load lecture summary: ${e.message}`);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [lectureId, classId]);

  function goBack() {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.delete("view");
    currentParams.delete("lectureId");
    const qs = currentParams.toString();
    router.push(qs ? `/class/${classId}?${qs}` : `/class/${classId}`);
  }

  return (
    // Full-bleed white; right pane can be overlaid by the top-right tab toggle (OK per you)
    <section className="h-full w-full bg-white flex flex-col">
      {/* Header aligned with LEFT Back row (same padding + border) */}
      <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-3">
        <button
            onClick={goBack}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-100 cursor-pointer" // ⬅️ added cursor-pointer
            >
            Back
        </button>
        {/* Title left-aligned, immediately to the right of Back */}
        <h1 className="text-sm font-semibold text-gray-900 truncate">
          {lecture?.originalName || "Lecture Summary"}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading summary...</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : !lecture?.summaryJson ? (
          <div className="text-sm text-gray-600">No summary available for this lecture.</div>
        ) : (
          <div className="prose prose-sm max-w-none text-black leading-relaxed">
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
              {lecture.summaryJson}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </section>
  );
}
