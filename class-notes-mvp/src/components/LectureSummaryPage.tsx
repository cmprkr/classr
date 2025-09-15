//components/LectureSummaryPage.tsx
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
        if (!r.ok) {
          const errorText = await r.text();
          throw new Error(errorText || "Failed to load lecture");
        }
        const data = await r.json();
        console.log("API Response:", data); // Debug: Log the full response
        if (mounted) {
          setLecture({
            id: data.id,
            originalName: data.originalName || "",
            summaryJson: data.summaryJson || data.summary || "", // Handle potential alternative field
            classId: data.classId || classId,
          });
        }
      } catch (e: any) {
        if (mounted) setError(`Failed to load lecture summary: ${e.message}`);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lectureId, classId]);

  function goBack() {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.delete("view");
    currentParams.delete("lectureId");
    const queryString = currentParams.toString();
    router.push(queryString ? `/class/${classId}?${queryString}` : `/class/${classId}`);
  }

  return (
    <section className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-pink-200" />
      <div className="relative h-full w-full flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900">
                {lecture?.originalName || "Lecture Summary"}
              </h1>
              <button
                onClick={goBack}
                className="px-4 py-2 rounded-lg border text-black hover:bg-gray-100"
              >
                Back
              </button>
            </div>
            {loading ? (
              <div className="text-sm text-gray-600">Loading summary...</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : !lecture?.summaryJson ? (
              <div className="text-sm text-gray-600">No summary available for this lecture.</div>
            ) : (
              <div className="prose prose-sm max-w-none text-black leading-relaxed overflow-auto max-h-[calc(100vh-200px)] mt-4">
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                  {lecture.summaryJson}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}