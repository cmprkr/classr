// src/app/page.tsx
import AllClassesPanel from "@/components/AllClassesPanel";
import RecorderPanel from "@/components/RecorderPanel"; // the recording UI

export const dynamic = "force-dynamic";

export default async function Home(props: { searchParams: Promise<{ record?: string }> }) {
  const search = await props.searchParams;            // ✅ await per Next’s requirement
  const showRecorder = search?.record === "1";

  return (
    <>
      {/* Left column: shared All Classes panel */}
      <AllClassesPanel />

      {/* Right column: either recorder or welcome */}
      {showRecorder ? (
        // Recorder fills the whole right pane
        <section className="flex-1 overflow-hidden bg-white">
          <div className="h-full w-full">
            <RecorderPanel />
          </div>
        </section>
      ) : (
        // Welcome gradient fills edge-to-edge
        <section className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-pink-200" />
          <div className="relative h-full w-full flex items-center justify-center p-6">
            <div className="text-center max-w-md p-6">
              <div className="inline-block px-4 py-1 bg-gradient-to-r from-pink-300 to-purple-300 rounded-full text-xs text-white font-semibold mb-4">
                Welcome
              </div>
              <div className="text-4xl text-pink-400 mb-2">❝</div>
              <p className="text-lg font-semibold text-gray-700">
                Learn relentlessly. Knowledge is the foundation of freedom.
              </p>
              <div className="text-xs text-pink-600 mt-2">- Charlie Kirk</div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
