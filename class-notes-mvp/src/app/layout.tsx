// app/layout.tsx
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const metadata = { title: "Product 1" };

export default async function Root({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const displayName = session?.user?.name ?? "Guest";
  const isSignedIn = !!session;

  return (
    <html lang="en">
      <body suppressHydrationWarning className="bg-white text-gray-800 h-screen overflow-hidden">
        <div className="flex h-full">
          <Sidebar displayName={displayName} isSignedIn={isSignedIn} />
          <main className="flex-1 flex overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
