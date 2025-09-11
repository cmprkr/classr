// app/class/[id]/page.tsx
import Uploader from "@/components/Uploader";
import ClassChat from "@/components/ClassChat";
import LectureList from "@/components/LectureList";
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
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <a href="/" className="text-sm text-black hover:underline">
        &larr; Back
      </a>
      <h1 className="text-2xl font-semibold text-black">{cls?.name ?? "Class"}</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Uploader classId={id} />

        {/* Lecture list with expandable summary + transcript */}
        <LectureList lectures={cls?.lectures ?? []} />
      </div>

      <ClassChat classId={id} />
    </main>
  );
}
