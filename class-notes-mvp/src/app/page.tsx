// src/app/page.tsx
import AllClassesPanel from "@/components/AllClassesPanel";
import RecorderPanel from "@/components/RecorderPanel";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: { record?: string };
}) {
  const showRecorder = searchParams?.record === "1";

  return (
    <>
      {/* Left column: shared All Classes panel */}
      <AllClassesPanel />

      {/* Right panel: recorder or welcome card */}
      <section className="flex-1 overflow-hidden bg-white">
        {showRecorder ? (
          <RecorderPanel />
        ) : (
          <div className="h-full flex items-center justify-center overflow-y-auto">
            <div className="text-center max-w-md p-6">
              <div className="inline-block px-4 py-1 bg-gradient-to-r from-pink-300 to-purple-300 rounded-full text-xs text-white font-semibold mb-4">
                Welcome
              </div>
              <div className="text-4xl text-pink-400 mb-2">❝</div>
              <p className="text-lg font-semibold text-gray-600">
                Learn relentlessly. Knowledge is the foundation of freedom.
              </p>
              <div className="text-xs text-pink-500 mt-2">- Charlie Kirk</div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
