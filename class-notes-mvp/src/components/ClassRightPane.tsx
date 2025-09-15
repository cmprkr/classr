// src/components/ClassRightPane.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import RecorderPanel from "@/components/RecorderPanel";
import Chat from "@/components/ClassChat";
import LectureSettingsPanel from "@/components/LectureSettingsPanel";
import ClassSettingsPanel from "src/components/ClassSettingsPanel";

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

  // Remember the last non-lecture tab to return to when closing lecture settings
  const lastNonLectureTabRef = useRef<"chat" | "record" | "class">(initialTab);

  // Parse URL intent
  const urlWantsRecord = searchParams.get("record") === "1";
  const lectureId = searchParams.get("lecture") || undefined;
  const urlWantsClassTab = searchParams.get("tab") === "class"; // optional: ?tab=class to deep-link class settings

  // 1) React to URL changes from sidebar (record) or lecture clicks (lecture)
  useEffect(() => {
    if (lectureId) {
      // When entering lecture settings, remember current non-lecture tab
      if (tab) lastNonLectureTabRef.current = tab;
      // Don't change `tab` — lecture settings is an overlay view
      return;
    }
    if (urlWantsRecord) {
      setTab("record");
    } else if (urlWantsClassTab) {
      setTab("class");
    } else {
      setTab("chat");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlWantsRecord, lectureId, urlWantsClassTab]);

  // 2) Keep URL in sync when user clicks tabs (never set ?lecture= here)
  useEffect(() => {
    const current = new URLSearchParams(searchParams.toString());
    // clear lecture param if switching tabs while a lecture was open
    if (current.has("lecture")) current.delete("lecture");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // 3) Recording status indicator (red dot in Sidebar)
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

  // Close lecture settings = clear ?lecture and return to last non-lecture tab
  const closeLecture = () => {
    const current = new URLSearchParams(searchParams.toString());
    current.delete("lecture");
    const qs = current.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setTab(lastNonLectureTabRef.current || "chat");
  };

  return (
    <div className="relative h-full w-full">
      {/* Top-right toggle (no lecture tab) */}
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
          title="Class settings"
        >
          Class
        </button>
      </div>

      {/* RECORDING view (full-bleed) */}
      <div className={`${tab === "record" ? "block" : "hidden"} h-full w-full`}>
        <RecorderPanel />
      </div>

      {/* CHAT view (full-bleed, no side gutters) */}
      <div className={`${tab === "chat" ? "block" : "hidden"} h-full w-full`}>
        <div className="px-4 pt-4">
          {classTitle && <h1 className="text-2xl font-semibold text-black">{classTitle}</h1>}
        </div>
        <div className="h-[calc(100%-56px)] px-4 pb-4">
          <Chat classId={classId} />
        </div>
      </div>

      {/* CLASS SETTINGS tab */}
      <div className={`${tab === "class" ? "block" : "hidden"} h-full w-full`}>
        <ClassSettingsPanel classId={classId} />
      </div>

      {/* LECTURE SETTINGS overlay (no tab) */}
      {lectureId && (
        <div className="absolute inset-0 z-20">
          <LectureSettingsPanel lectureId={lectureId} onClose={closeLecture} />
        </div>
      )}
    </div>
  );
}
