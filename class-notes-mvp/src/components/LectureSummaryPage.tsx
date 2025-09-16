// components/LectureSummaryPage.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

type Lecture = {
  id: string;
  originalName: string;
  summaryJson?: string | null;
  classId?: string;
};

export default function LectureSummaryPage({
  lectureId,
  classId,
}: { lectureId: string; classId: string }) {
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

  const mdComponents = useMemo(
    () => ({
      h1: (props: any) => (
        <h1
          className="mt-6 scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl text-black"
          {...props}
        />
      ),
      h2: (props: any) => (
        <h2
          className="mt-10 scroll-m-20 pb-2 text-2xl font-bold tracking-tight first:mt-0 lg:text-3xl text-black"
          {...props}
        />
      ),
      h3: (props: any) => (
        <h3 className="mt-8 scroll-m-20 text-xl font-semibold tracking-tight text-black lg:text-2xl" {...props} />
      ),
      h4: (props: any) => (
        <h4 className="mt-6 scroll-m-20 text-lg font-semibold tracking-tight text-black" {...props} />
      ),
      p: (props: any) => <p className="leading-8 text-black" {...props} />,
      ul: (props: any) => (
        <ul className="my-6 ml-6 list-disc space-y-2 marker:text-black text-black" {...props} />
      ),
      ol: (props: any) => (
        <ol className="my-6 ml-6 list-decimal space-y-2 marker:text-black text-black" {...props} />
      ),
      li: (props: any) => <li className="pl-1 text-black" {...props} />,
      a: (props: any) => (
        <a
          className="font-medium underline underline-offset-4 text-black hover:opacity-80"
          target="_blank"
          rel="noreferrer"
          {...props}
        />
      ),
      blockquote: (props: any) => (
        <blockquote className="my-6 border-l-4 border-gray-300 bg-gray-50 px-4 py-3 italic text-black" {...props} />
      ),
      code: ({ inline, ...props }: any) =>
        inline ? (
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.95em] text-black" {...props} />
        ) : (
          <code className="block w-full overflow-x-auto rounded-xl bg-gray-900 px-4 py-3 font-mono text-sm text-white" {...props} />
        ),
      pre: (props: any) => <pre className="not-prose" {...props} />,
      hr: (props: any) => <hr className="my-10 border-t border-gray-300" {...props} />,
      table: (props: any) => (
        <div className="my-6 w-full overflow-x-auto rounded-xl border border-gray-300">
          <table className="w-full text-left text-sm text-black" {...props} />
        </div>
      ),
      thead: (props: any) => <thead className="bg-gray-100" {...props} />,
      th: (props: any) => (
        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-black" {...props} />
      ),
      td: (props: any) => <td className="px-4 py-3 align-top text-black" {...props} />,
      img: (props: any) => <img className="my-4 mx-auto rounded-lg shadow" {...props} />,
      strong: (props: any) => <strong className="font-semibold text-black" {...props} />,
      em: (props: any) => <em className="text-black" {...props} />,
    }),
    []
  );

  return (
    <section className="h-full w-full bg-white flex flex-col">
      {/* Header aligned with LEFT Back row (same padding + border) */}
      <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-3">
        <button
          onClick={goBack}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-black hover:bg-gray-100 cursor-pointer"
        >
          Back
        </button>
        <h1 className="text-sm font-semibold text-black truncate">
          {lecture?.originalName || "Lecture Summary"}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-5 py-6">
          {loading ? (
            <div className="text-sm text-black">Loading summary...</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : !lecture?.summaryJson ? (
            <div className="text-sm text-black">No summary available for this lecture.</div>
          ) : (
            <article
              className={[
                "prose prose-lg lg:prose-xl max-w-none",
                "prose-headings:text-black prose-p:text-black prose-li:text-black prose-strong:text-black prose-a:text-black",
                "prose-h1:mt-2 prose-h1:mb-4 prose-h2:mt-10 prose-h2:mb-3 prose-h3:mt-8 prose-h3:mb-2",
              ].join(" ")}
            >
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                remarkPlugins={[remarkGfm]}
                components={mdComponents}
              >
                {lecture.summaryJson}
              </ReactMarkdown>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
