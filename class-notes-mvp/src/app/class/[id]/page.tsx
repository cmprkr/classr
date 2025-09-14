// src/app/class/[id]/page.tsx
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import ClassLeftPane from "@/components/ClassLeftPane";
import ClassRightPane from "@/components/ClassRightPane";

export const dynamic = "force-dynamic";

export default async function ClassPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ record?: string }>;
}) {
  const { id } = await props.params;
  const sp = (await props.searchParams) ?? {};
  const showRecorder = sp.record === "1";

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
        <a href="/" className="text-sm text-black hover:underline">&larr; Back</a>
        <h1 className="mt-3 text-2xl font-semibold">Class not found</h1>
      </main>
    );
  }

  return (
    // full-height split: left = list; right = content (no max-width to avoid gutters)
    <main className="h-screen w-full overflow-hidden flex bg-white">
      <ClassLeftPane classId={cls.id} lectures={cls.lectures as any[]} />

      {/* Right: edge-to-edge content with toggle between Recording/Chat */}
      <section className="relative flex-1 overflow-hidden">
        <ClassRightPane
          classId={cls.id}
          initialTab={showRecorder ? "record" : "chat"}
          classTitle={cls.name}
        />
      </section>
    </main>
  );
}
