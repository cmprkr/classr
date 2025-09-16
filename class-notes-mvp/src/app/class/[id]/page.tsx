// app/class/[id]/page.tsx
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import ClassRightPane from "@/components/ClassRightPane";
import ClassLeftPane from "@/components/ClassLeftPane";

export const dynamic = "force-dynamic";

export default async function ClassPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const user = await requireUser();

  const cls = await db.class.findFirst({
    where: { id, userId: user.id },
    include: {
      lectures: {
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
          includeInMemory: true, // legacy (still sent, but we prefer viewerIncludeInAISummary)
          syncKey: true,
          createdAt: true,
          // Pull THIS viewer's pref for each owned lecture
          userPrefs: {
            where: { userId: user.id },
            select: { includeInAISummary: true },
            take: 1,
          },
        },
      },
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

  // If synced, fetch all lectures sharing the syncKey and include viewer's pref too
  let mergedLectures: any[] = cls.lectures.map((l) => ({
    ...l,
    viewerIncludeInAISummary:
      l.userPrefs?.[0]?.includeInAISummary ??
      (typeof l.includeInMemory === "boolean" ? l.includeInMemory : true),
  }));

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
        includeInMemory: true, // legacy
        syncKey: true,
        createdAt: true,
        userPrefs: {
          where: { userId: user.id },
          select: { includeInAISummary: true },
          take: 1,
        },
      },
    });

    const enrichedSynced = synced.map((l) => ({
      ...l,
      viewerIncludeInAISummary:
        l.userPrefs?.[0]?.includeInAISummary ??
        (typeof l.includeInMemory === "boolean" ? l.includeInMemory : true),
    }));

    const byId = new Map<string, any>();
    for (const l of [...mergedLectures, ...enrichedSynced]) byId.set(l.id, l);
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
