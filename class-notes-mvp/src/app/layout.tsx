// app/layout.tsx
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata = { title: "Product 1" };

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="bg-white text-gray-800 h-screen overflow-hidden">
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 flex overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
