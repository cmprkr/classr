"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import RecorderPanel from "@/components/RecorderPanel";
import ClassChat from "@/components/ClassChat";
import ClassSettingsPanel from "@/components/ClassSettingsPanel";
import LectureSummaryPage from "@/components/LectureSummaryPage";

export default function ClassRightPane({
  classId,
  initialTab = "chat",
  classTitle,
}: {
  classId: string;
  initialTab?: "chat" | "record" | "class";
  classTitle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<"chat" | "record" | "class">(initialTab);
  const [recActive, setRecActive] = useState(false);

  // URL-derived intents
  const urlWantsRecord = searchParams.get("record") === "1";
  const urlWantsSettingsTab = searchParams.get("tab") === "class";

  // Summary overlay (independent of tab)
  const viewLecture = searchParams.get("view") === "lecture";
  const lectureId = (searchParams.get("lectureId") || "").trim();

  // React to URL changes -> set tab (summary overlay is handled separately)
  useEffect(() => {
    if (urlWantsRecord) setTab("record");
    else if (urlWantsSettingsTab) setTab("class");
    else setTab("chat");
  }, [urlWantsRecord, urlWantsSettingsTab]);

  // Recording status indicator (red dot)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as boolean;
      setRecActive(Boolean(detail));
    };
    try {
      setRecActive(sessionStorage.getItem("recActive") === "1");
    } catch {}
    window.addEventListener("rec:active", handler as EventListener);
    return () => window.removeEventListener("rec:active", handler as EventListener);
  }, []);

  // Navigate to a tab and CLEAR summary params so overlay collapses
  function go(next: "record" | "chat" | "class") {
    const current = new URLSearchParams(searchParams.toString());

    // Always clear any summary view when a top tab is clicked
    current.delete("view");
    current.delete("lectureId");

    if (next === "record") {
      current.set("record", "1");
      current.delete("tab");
    } else if (next === "class") {
      current.delete("record");
      current.set("tab", "class");
    } else {
      // chat
      current.delete("record");
      current.delete("tab");
    }

    setTab(next);
    const qs = current.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="relative h-full w-full">
      {/* Top-right toggle */}
      <div className="absolute right-4 top-4 z-30 rounded-lg border bg-white/80 backdrop-blur px-1 py-1 flex gap-1 shadow-sm">
        <button
          onClick={() => go("record")}
          className={`px-3 py-1 rounded-md text-sm cursor-pointer ${
            tab === "record"
              ? "bg-black text-white"
              : "text-black hover:bg-white"
          }`}
          title="Recording"
        >
          Recording
          {recActive && (
            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
          )}
        </button>
        <button
          onClick={() => go("chat")}
          className={`px-3 py-1 rounded-md text-sm cursor-pointer ${
            tab === "chat"
              ? "bg-black text-white"
              : "text-black hover:bg-white"
          }`}
          title="Class chat"
        >
          Chat
        </button>
        <button
          onClick={() => go("class")}
          className={`px-3 py-1 rounded-md text-sm cursor-pointer ${
            tab === "class"
              ? "bg-black text-white"
              : "text-black hover:bg-white"
          }`}
          title="Settings"
        >
          Settings
        </button>
      </div>

      {/* RECORDING view */}
      <div className={`${tab === "record" ? "block" : "hidden"} h-full w-full`}>
        <RecorderPanel />
      </div>

      {/* CHAT view */}
      <div className={`${tab === "chat" ? "block" : "hidden"} h-full w-full`}>
        <ClassChat classId={classId} classTitle={classTitle || "Class"} />
      </div>

      {/* SETTINGS view (Class only) */}
      <div className={`${tab === "class" ? "block" : "hidden"} h-full w-full`}>
        <ClassSettingsPanel classId={classId} />
      </div>

      {/* ⬇️ SUMMARY OVERLAY — shows over ANY tab when view=lecture */}
      {viewLecture && lectureId && (
        <div className="absolute inset-0 z-20 bg-white">
          <LectureSummaryPage lectureId={lectureId} classId={classId} />
        </div>
      )}
    </div>
  );
}
