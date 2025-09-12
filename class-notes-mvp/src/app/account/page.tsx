// app/account/page.tsx
export const dynamic = "force-dynamic";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import AllClassesPanel from "@/components/AllClassesPanel";
import AccountClient from "./AccountClient";
import { db } from "@/lib/db";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);

  // Always pull fresh data from DB so profile card + sidebar are in sync
  let dbUser:
    | { id: string; name: string | null; email: string | null; image: string | null }
    | null = null;

  if (session?.user?.id) {
    dbUser = await db.user.findUnique({
      where: { id: session.user.id as string },
      select: { id: true, name: true, email: true, image: true },
    });
  }

  const user = {
    id: dbUser?.id ?? ((session?.user as any)?.id ?? null),
    name: dbUser?.name ?? (session?.user?.name ?? ""),
    email: dbUser?.email ?? (session?.user?.email ?? ""),
    image: dbUser?.image ?? ((session?.user as any)?.image ?? null),
  };

  return (
    <>
      {/* Left: All Classes */}
      <AllClassesPanel />

      {/* Right: gradient background; scrolling handled by AccountClient */}
      <section className="relative flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-pink-200" />
        <AccountClient user={user} isSignedIn={!!session} />
      </section>
    </>
  );
}
