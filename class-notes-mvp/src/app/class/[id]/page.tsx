import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import Chat from "@/components/ClassChat";
import ClassLeftPane from "@/components/ClassLeftPane";
import RecorderPanel from "@/components/RecorderPanel";
import LectureSettingsPanel from "@/components/LectureSettingsPanel";

export const dynamic = "force-dynamic";

type SearchParams = {
  pane?: "chat" | "record" | "lecture-settings";
  record?: string;    // legacy support: record=1
  lecture?: string;   // lectureId for lecture settings
  lectureId?: string; // legacy key
};

export default async function ClassPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: SearchParams;
}) {
  const { id } = await props.params;
  const sp = props.searchParams ?? {};
  const user = await requireUser();

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

  // If syncing is enabled and a syncKey exists, pull ALL lectures with that key (any user/class)
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

  // Determine which pane to show
  const lectureId = sp.lecture || sp.lectureId;
  let pane: "chat" | "record" | "lecture-settings" =
    sp.pane || (sp.record === "1" ? "record" : lectureId ? "lecture-settings" : "chat");

  return (
    <main className="h-screen w-full overflow-hidden flex bg-white">
      {/* Left: Items (includes synced) */}
      <ClassLeftPane
        classId={cls.id}
        lectures={mergedLectures}
        currentUserId={user.id}
      />

      {/* Right: content area with a small header toggle */}
      <section className="flex-1 overflow-hidden flex flex-col">
        <div className="border-b px-6 pt-6 pb-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black truncate">{cls.name}</h1>
          <div className="flex items-center gap-1">
            <a
              href={`/class/${cls.id}?pane=chat`}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                pane === "chat"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
              }`}
            >
              Chat
            </a>
            <a
              href={`/class/${cls.id}?pane=record`}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                pane === "record"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
              }`}
            >
              Record
            </a>
            <a
              href={`/class/${cls.id}?pane=lecture-settings${lectureId ? `&lecture=${lectureId}` : ""}`}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                pane === "lecture-settings"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
              }`}
            >
              Lecture Settings
            </a>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {pane === "chat" && (
            <div className="h-full">
              <Chat classId={cls.id} />
            </div>
          )}

          {pane === "record" && (
            <div className="h-full">
              <RecorderPanel />
            </div>
          )}

          {pane === "lecture-settings" && lectureId && (
            <div className="relative h-full">
              {/* Gradient shell like your auth pages */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-pink-200" />
              <div className="relative h-full w-full flex items-center justify-center p-6">
                <div className="w-full max-w-2xl">
                  <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5 p-6 sm:p-8">
                    <LectureSettingsPanel
                      lectureId={lectureId}
                      onClose={() => {
                        // go back to chat if close is used
                        // (client side controls the actual click; this is a server component)
                      }}
                      onRenamed={() => {
                        // no-op; the list will refresh next navigation
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {pane === "lecture-settings" && !lectureId && (
            <div className="h-full grid place-items-center text-sm text-gray-600">
              Select a lecture to view settings.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
