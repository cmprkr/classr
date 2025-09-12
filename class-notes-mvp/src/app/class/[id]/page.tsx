// src/app/class/[id]/page.tsx
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import Chat from "@/components/ClassChat";
import ClassLeftPane from "@/components/ClassLeftPane"; // ← new

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
        <Link href="/" className="text-sm text-black hover:underline">&larr; Back</Link>
        <h1 className="mt-3 text-2xl font-semibold">Class not found</h1>
      </main>
    );
  }

  return (
    // full-height split panes; left = items list, right = content
    <main className="h-screen w-full overflow-hidden flex bg-white">
      {/* Left: Use new client component that controls uploader visibility but keeps it at the top */}
      <ClassLeftPane classId={cls.id} lectures={cls.lectures as any[]} />

      {/* Right: Content area (unchanged) */}
      <section className="flex-1 overflow-hidden">
        <div className="h-full mx-auto max-w-4xl p-6 flex flex-col">
          <h1 className="text-2xl font-semibold text-black">{cls.name}</h1>
          <div className="flex-1 p-4 rounded-2xl border bg-white overflow-y-auto">
            <Chat classId={cls.id} />
          </div>
        </div>
      </section>
    </main>
  );
}
