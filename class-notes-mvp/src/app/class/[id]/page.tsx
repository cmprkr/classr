// app/class/[id]/page.tsx
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import ClassRightPane from "@/components/ClassRightPane";
import ClassLeftPane from "@/components/ClassLeftPane";
import LectureSummaryPage from "@/components/LectureSummaryPage"; // Add this import

export const dynamic = "force-dynamic";

export default async function ClassPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams; // Await searchParams
  const user = await requireUser();

  // Check if we should render the lecture summary page
  const viewLecture = sp.view === "lecture" && sp.lectureId;
  if (viewLecture) {
    // For client-side rendering of summary, pass props to client component
    // Note: Since LectureSummaryPage is "use client", we render it here conditionally
    return (
      <main className="h-screen w-full overflow-hidden bg-white">
        <LectureSummaryPage lectureId={sp.lectureId!} classId={id} />
      </main>
    );
  }

  // Original class page logic (unchanged)
  // Base class (owner's) with its own lectures & chats
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
  // If syncing is enabled and a syncKey exists, pull ALL lectures with that key
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
    // Merge with local list, de-dupe by id, then sort desc by createdAt
    const byId = new Map<string, any>();
    for (const l of [...cls.lectures, ...synced]) byId.set(l.id, l);
    mergedLectures = Array.from(byId.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  // Determine initial tab from searchParams
  const lectureId = sp.lectureId || sp.lecture; // Support both keys
  const initialTab: "chat" | "record" | "class" =
    sp.tab === "class" ? "class" : sp.record === "1" ? "record" : "chat";
  return (
    <main className="h-screen w-full overflow-hidden flex bg-white">
      {/* Left: Items (includes synced) */}
      <ClassLeftPane
        classId={cls.id}
        lectures={mergedLectures}
        currentUserId={user.id}
      />
      {/* Right: Delegate all pane rendering to ClassRightPane */}
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