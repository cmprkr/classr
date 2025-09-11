// src/app/class/[id]/page.tsx
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import Uploader from "@/components/Uploader";
import LectureItem from "@/components/LectureItem";
import Chat from "@/components/ClassChat";

export const dynamic = "force-dynamic";

export default async function ClassPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await requireUser();

  const cls = await db.class.findFirst({
    where: { id, userId: user.id },
    include: {
      lectures: { orderBy: { createdAt: "desc" } },
      chats: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!cls) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <Link href="/" className="text-sm opacity-80 hover:underline">&larr; Back</Link>
        <h1 className="mt-3 text-2xl font-semibold">Class not found</h1>
      </main>
    );
  }

  return (
    // full-height split panes; left = items list, right = content
    <main className="h-screen w-full overflow-hidden flex bg-white">
      {/* Left: Items list (second sidebar) */}
      <aside className="w-96 shrink-0 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <Link href="/" className="text-sm opacity-80 hover:underline">&larr; Back</Link>
          <h2 className="mt-2 text-sm font-semibold">Items</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cls.lectures.length === 0 && (
            <div className="text-sm opacity-70">No items yet.</div>
          )}
          {cls.lectures.map((l) => (
            <LectureItem key={l.id} l={l} />
          ))}
        </div>
      </aside>

      {/* Right: Content area */}
      <section className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-6 space-y-6">
          <h1 className="text-2xl font-semibold">{cls.name}</h1>

          {/* Uploader card */}
          <div className="rounded-2xl border bg-white p-4">
            <h3 className="font-medium mb-2">Add Material</h3>
            <Uploader classId={cls.id} />
          </div>

          {/* Chat (spans content width) */}
          <div className="rounded-2xl border bg-white p-4">
            <Chat classId={cls.id} />
          </div>
        </div>
      </section>
    </main>
  );
}
