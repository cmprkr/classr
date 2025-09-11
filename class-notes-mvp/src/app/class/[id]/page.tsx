// app/class/[id]/page.tsx
import Uploader from "@/components/Uploader";
import ClassChat from "@/components/ClassChat";
import { db } from "@/lib/db";

export default async function ClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cls = await db.class.findUnique({
    where: { id },
    include: { lectures: { orderBy: { createdAt: "desc" } }, chats: true },
  });

  return (
    <>
      {/* Middle list: lectures */}
      <section className="w-96 bg-white border-r overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">{cls?.name ?? "Class"}</h2>
          <a href="/" className="text-xs text-blue-600 hover:underline">&larr; All Classes</a>
        </div>

        <div className="space-y-2">
          {(cls?.lectures ?? []).map((l) => (
            <details key={l.id} className="bg-gray-50 rounded-lg border">
              <summary className="p-3 cursor-pointer">
                <div className="text-sm font-semibold text-gray-900">{l.originalName}</div>
                <div className="text-xs text-gray-600 mt-1">
                  Status: {l.status}
                  {l.status === "READY" && ` • ${l.durationSec ?? "?"}s`}
                </div>
              </summary>
              {l.summaryJson && (
                <div className="px-3 pb-3 text-sm text-gray-900">
                  <div className="font-medium mb-1">Summary</div>
                  <div className="bg-white border rounded p-2 whitespace-pre-wrap">
                    {String(l.summaryJson).slice(0, 240)}
                    {String(l.summaryJson).length > 240 ? "…" : ""}
                  </div>
                </div>
              )}
            </details>
          ))}
          {(cls?.lectures ?? []).length === 0 && (
            <div className="text-sm text-gray-600">No lectures yet.</div>
          )}
        </div>
      </section>

      {/* Right panel: same “calm white” vibe as welcome page */}
      <section className="flex-1 bg-white overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6 space-y-6">
          {/* Hero-ish header to mirror welcome feel */}
          <div className="text-center">
            <div className="inline-block px-4 py-1 bg-gradient-to-r from-pink-300 to-purple-300 rounded-full text-xs text-white font-semibold mb-4">
              {cls?.name ?? "Class"}
            </div>
            <p className="text-lg font-semibold text-gray-600">
              Upload audio, read summaries, browse transcripts, and chat scoped to this class.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Uploader classId={id} />

            {/* Full summaries & transcripts */}
            <div className="rounded-2xl border bg-white p-4">
              <h3 className="font-medium mb-2 text-black">Lecture Details</h3>
              <div className="space-y-4">
                {(cls?.lectures ?? []).map((l) => (
                  <details key={l.id} className="border rounded">
                    <summary className="p-3 cursor-pointer text-sm font-semibold text-gray-900">
                      {l.originalName}
                    </summary>
                    <div className="p-3 space-y-4">
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
                  </details>
                ))}
              </div>
            </div>
          </div>

          <ClassChat classId={id} />
        </div>
      </section>
    </>
  );
}
