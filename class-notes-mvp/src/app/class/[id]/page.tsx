import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import Chat from "@/components/ClassChat";
import ClassLeftPane from "@/components/ClassLeftPane";
import LectureSettings from "@/components/LectureSettings";

export const dynamic = "force-dynamic";

export default async function ClassPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lecture?: string }>;
}) {
  const { id } = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const lectureId = searchParams.lecture;

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
        <Link href="/" className="text-sm text-black hover:underline">&larr; Back</Link>
        <h1 className="mt-3 text-2xl font-semibold">Class not found</h1>
      </main>
    );
  }

  // If ?lecture= is set, load that lecture for initialName
  let targetName: string | null = null;
  if (lectureId) {
    const target = cls.lectures.find((x: any) => x.id === lectureId);
    targetName = target?.originalName ?? null;
  }

  return (
    <main className="h-screen w-full overflow-hidden flex bg-white">
      <ClassLeftPane classId={cls.id} lectures={cls.lectures as any[]} />

      {/* Right pane: show settings if a lecture is selected; otherwise chat */}
      <section className="flex-1 min-w-0 overflow-hidden">
        <div className="h-full flex flex-col">
          <header className="px-4 py-3">
            <h1 className="text-2xl font-semibold text-black">{cls.name}</h1>
          </header>

          <div className="flex-1 min-h-0">
            {lectureId && targetName ? (
              <LectureSettings classId={cls.id} lectureId={lectureId} initialName={targetName} />
            ) : (
              <Chat classId={cls.id} />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
