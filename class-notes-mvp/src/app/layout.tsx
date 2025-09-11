// app/layout.tsx
import "./globals.css";
export const metadata = { title: "Class Notes MVP" };

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* 👇 add suppressHydrationWarning */}
      <body suppressHydrationWarning className="min-h-screen bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}