// app/class/[id]/page.tsx
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import ClassRightPane from "@/components/ClassRightPane";
import ClassLeftPane from "@/components/ClassLeftPane";
// ⛔️ REMOVE: import LectureSummaryPage

export const dynamic = "force-dynamic";

export default async function ClassPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const user = await requireUser();

  // ⛔️ REMOVE the early return that rendered <LectureSummaryPage/>

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
        <Link href="/" className="text-sm text-black hover:underline">
          &larr; Back
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Class not found</h1>
      </main>
    );
  }

  let mergedLectures = cls.lectures as any[];
  if (cls.syncEnabled && cls.syncKey) {
    const synced = await db.lecture.findMany({
      where: { syncKey: cls.syncKey },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        classId: true,
        userId: true,
        originalName: true,
        status: true,
        durationSec: true,
        kind: true,
        summaryJson: true,
        transcript: true,
        textContent: true,
        includeInMemory: true,
        syncKey: true,
        createdAt: true,
      },
    });
    const byId = new Map<string, any>();
    for (const l of [...cls.lectures, ...synced]) byId.set(l.id, l);
    mergedLectures = Array.from(byId.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const initialTab: "chat" | "record" | "class" =
    sp.tab === "class" ? "class" : sp.record === "1" ? "record" : "chat";

  return (
    <main className="h-screen w-full overflow-hidden flex bg-white">
      <ClassLeftPane
        classId={cls.id}
        lectures={mergedLectures}
        currentUserId={user.id}
      />
      {/* ⬇️ remove border-l to avoid double-thick divider */}
      <section className="flex-1 overflow-hidden flex flex-col">
        <ClassRightPane
          classId={cls.id}
          initialTab={initialTab}
          classTitle={cls.name}
        />
      </section>
    </main>
  );
}
