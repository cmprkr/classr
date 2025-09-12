"use client";
import AllClassesPanel from "@/components/AllClassesPanel";

export default function Home() {
  return (
    <>
      {/* Left column: shared All Classes panel */}
      <AllClassesPanel />

      {/* Right panel: your existing welcome card */}
      <section className="flex-1 flex items-center justify-center bg-white overflow-y-auto">
        <div className="text-center max-w-md p-6">
          <div className="inline-block px-4 py-1 bg-gradient-to-r from-pink-300 to-purple-300 rounded-full text-xs text-white font-semibold mb-4">
            Welcome
          </div>
          <div className="text-4xl text-pink-400 mb-2">❝</div>
          <p className="text-lg font-semibold text-gray-600">
            The only way to do great work is to love what you do.
          </p>
          <div className="text-xs text-pink-500 mt-2">—— Shared Inspiration</div>
        </div>
      </section>
    </>
  );
}
