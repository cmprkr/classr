// app/account/page.tsx
export const dynamic = "force-dynamic";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import AllClassesPanel from "@/components/AllClassesPanel";
import AccountClient from "./AccountClient";
import { db } from "@/lib/db";

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNullableId(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export default async function AccountPage() {
  const session = await getServerSession(authOptions);

  // Authoritative user from DB (if signed in)
  const dbUser =
    session?.user?.id
      ? await db.user.findUnique({
          where: { id: (session.user as any).id as string },
          select: { id: true, name: true, email: true, image: true, username: true },
        })
      : null;

  // Build the exact shape AccountClient expects:
  // { id: string | null; name: string; email: string; image: string | null; username?: string | null }
  const user = {
    id: asNullableId(dbUser?.id ?? (session?.user as any)?.id),
    name: asString(dbUser?.name ?? session?.user?.name, ""),
    email: asString(dbUser?.email ?? session?.user?.email, ""),
    image: asNullableString(dbUser?.image ?? (session?.user as any)?.image),
    username: asNullableString(dbUser?.username ?? (session?.user as any)?.username ?? null) ?? null,
  };

  return (
    <>
      {/* Left: All Classes */}
      <AllClassesPanel />

      {/* Right: gradient background; scrolling handled by AccountClient */}
      <section className="relative flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-pink-200" />
        <AccountClient user={user} isSignedIn={!!session?.user} />
      </section>
    </>
  );
}
