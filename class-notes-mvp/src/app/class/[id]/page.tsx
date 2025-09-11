// app/class/[id]/page.tsx  (or src/app/...)
import Uploader from "@/components/Uploader";
import ClassChat from "@/components/ClassChat";
import { db } from "@/lib/db";

// 👇 params is a Promise now
export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;  // ✅ await it

  const cls = await db.class.findUnique({
    where: { id },
    include: { lectures: { orderBy: { createdAt: "desc" } }, chats: true },
  });

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <a href="/" className="text-sm text-gray-700 hover:underline">&larr; Back</a>
      <h1 className="text-2xl font-semibold">{cls?.name ?? "Class"}</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Uploader classId={id} />   {/* ← no onDone prop */}
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-medium mb-2">Lectures</h2>
          <ul className="space-y-2">
            {(cls?.lectures ?? []).map((l:any)=>(
              <li key={l.id} className="rounded-lg border p-3">
                <div className="text-sm font-medium text-gray-900">{l.originalName}</div>
                <div className="text-xs text-gray-800">Status: {l.status}</div>
                {l.status==="READY" && (
                  <div className="text-xs text-gray-800">Duration: {l.durationSec ?? "?"}s</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ClassChat classId={id} />
    </main>
  );
}
