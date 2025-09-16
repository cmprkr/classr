// app/layout.tsx
export const dynamic = "force-dynamic";

import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

export const metadata = { title: "classr" };

export default async function Root({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  let displayName = "Guest";
  let isSignedIn = false;
  let userImage: string | null = null;

  if (session?.user?.id) {
    isSignedIn = true;
    const u = await db.user.findUnique({
      where: { id: session.user.id as string },
      select: { name: true, image: true },
    });
    displayName = u?.name || session.user.name || "User";
    userImage = (u?.image as string | null) ?? (session.user.image as string | null) ?? null;
  }

  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className="bg-white text-gray-800 h-screen overflow-hidden"
      >
        <div className="flex h-full">
          <Sidebar displayName={displayName} isSignedIn={isSignedIn} userImage={userImage} />
          <main className="flex-1 flex overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
