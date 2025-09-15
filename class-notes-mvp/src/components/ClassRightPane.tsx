// src/components/ClassRightPane.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import RecorderPanel from "@/components/RecorderPanel";
import Chat from "@/components/ClassChat";
import LectureSettingsPanel from "@/components/LectureSettingsPanel";
import ClassSettingsPanel from "@/components/ClassSettingsPanel";

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

  // Fix: Include "class" in the tab type
  const [tab, setTab] = useState<"chat" | "record" | "class">(initialTab);
  const [recActive, setRecActive] = useState(false);

  // Remember the last non-settings tab to return to when closing lecture settings
  const lastNonSettingsTabRef = useRef<"chat" | "record">(initialTab === "class" ? "chat" : initialTab);

  // Parse URL intent
  const urlWantsRecord = searchParams.get("record") === "1";
  const lectureId = searchParams.get("lectureId") || undefined;
  const urlWantsSettingsTab = searchParams.get("tab") === "class";

  // 1) React to URL changes
  useEffect(() => {
    if (lectureId) {
      // When lectureId is present, force Settings tab and remember previous tab
      if (tab !== "class") {
        lastNonSettingsTabRef.current = tab;
        setTab("class");
      }
      return;
    }
    if (urlWantsRecord) {
      setTab("record");
    } else if (urlWantsSettingsTab) {
      setTab("class");
    } else {
      setTab("chat");
    }
  }, [urlWantsRecord, lectureId, urlWantsSettingsTab]);

  // 2) Keep URL in sync when tab changes
  useEffect(() => {
    const current = new URLSearchParams(searchParams.toString());
    // Clear lectureId when switching away from Settings tab
    if (tab !== "class" && current.has("lectureId")) {
      current.delete("lectureId");
    }

    if (tab === "record") {
      current.set("record", "1");
      if (current.get("tab") === "class") current.delete("tab");
    } else if (tab === "class") {
      current.delete("record");
      current.set("tab", "class");
    } else {
      current.delete("record");
      if (current.get("tab") === "class") current.delete("tab");
    }

    const qs = current.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [tab, router, pathname, searchParams]);

  // 3) Recording status indicator
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

  // Close lecture settings = return to previous tab
  const closeLecture = () => {
    setTab(lastNonSettingsTabRef.current || "chat");
  };

  return (
    <div className="relative h-full w-full">
      {/* Top-right toggle */}
      <div className="absolute right-4 top-4 z-30 rounded-lg border bg-white/80 backdrop-blur px-1 py-1 flex gap-1 shadow-sm">
        <button
          onClick={() => setTab("record")}
          className={`px-3 py-1 rounded-md text-sm ${tab === "record" ? "bg-black text-white" : "hover:bg-white"}`}
          title="Recording"
        >
          Recording
          {recActive && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />}
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`px-3 py-1 rounded-md text-sm ${tab === "chat" ? "bg-black text-white" : "hover:bg-white"}`}
          title="Class chat"
        >
          Chat
        </button>
        <button
          onClick={() => setTab("class")}
          className={`px-3 py-1 rounded-md text-sm ${tab === "class" ? "bg-black text-white" : "hover:bg-white"}`}
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
        <div className="px-4 pt-4">
          {classTitle && <h1 className="text-2xl font-semibold text-black">{classTitle}</h1>}
        </div>
        <div className="h-[calc(100%-56px)] px-4 pb-4">
          <Chat classId={classId} />
        </div>
      </div>

      {/* SETTINGS view (Class or Lecture) */}
      <div className={`${tab === "class" ? "block" : "hidden"} h-full w-full`}>
        {lectureId ? (
          <LectureSettingsPanel lectureId={lectureId} onClose={closeLecture} />
        ) : (
          <ClassSettingsPanel classId={classId} />
        )}
      </div>
    </div>
  );
}