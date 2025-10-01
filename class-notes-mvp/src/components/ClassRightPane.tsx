"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import RecorderPanel from "@/components/RecorderPanel";
import ClassChat from "@/components/ClassChat";
import ClassSettingsPanel from "@/components/ClassSettingsPanel";
import LectureSummaryPage from "@/components/LectureSummaryPage";
import ClassHomeGrid from "@/components/ClassHomeGrid";

export default function ClassRightPane({
  classId,
  initialTab = "home",
  classTitle,
  lectures = [],
}: {
  classId: string;
  initialTab?: "home" | "chat" | "record" | "class";
  classTitle?: string;
  lectures?: any[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<"home" | "chat" | "record" | "class">(initialTab);
  const [recActive, setRecActive] = useState(false);

  // URL-derived intents
  const urlWantsRecord = searchParams.get("record") === "1";
  const urlWantsSettingsTab = searchParams.get("tab") === "class";
  const urlWantsChatTab = searchParams.get("tab") === "chat";

  // Summary overlay (independent of tab)
  const viewLecture = searchParams.get("view") === "lecture";
  const lectureId = (searchParams.get("lectureId") || "").trim();

  // React to URL changes -> set tab (summary overlay handled separately)
  useEffect(() => {
    if (urlWantsRecord) setTab("record");
    else if (urlWantsSettingsTab) setTab("class");
    else if (urlWantsChatTab) setTab("chat");
    else setTab("home");
  }, [urlWantsRecord, urlWantsSettingsTab, urlWantsChatTab]);

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
  function go(next: "home" | "record" | "chat" | "class") {
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
    } else if (next === "chat") {
      current.delete("record");
      current.set("tab", "chat");
    } else {
      // home
      current.delete("record");
      current.delete("tab");
    }

    setTab(next);
    const qs = current.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Icon nav model
  const NAV = [
    { key: "home" as const,   icon: "/icons/square-dashed.svg",      title: "Home" },
    { key: "record" as const, icon: "/icons/mic.svg",                 title: "Recording" },
    { key: "chat" as const,   icon: "/icons/message-circle-dots.svg", title: "Chat" },
    { key: "class" as const,  icon: "/icons/gear.svg",                title: "Settings" },
  ];

  const isActive = (k: typeof NAV[number]["key"]) => tab === k;

  return (
    <div className="relative h-full w-full">
      {/* HOME (Main) — has its own header */}
      {tab === "home" && (
        <div className="h-full w-full flex flex-col bg-white">
          <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
            <h1 className="text-sm font-semibold text-black truncate">Main</h1>
            {/* Invisible Back button placeholder (keeps header height consistent) */}
            <button
              disabled
              className="invisible px-4 py-2 rounded-lg border border-gray-300 text-sm"
            >
              Back
            </button>
          </div>
          <ClassHomeGrid
            classId={classId}
            classTitle={classTitle || "Class"}
            lectures={lectures}
          />
        </div>
      )}

      {/* Top-right icon nav (separate squares; always visible).
          Includes conditional Refresh button on far left ONLY when summary overlay is open. */}
      <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
        {/* Refresh button — only when the lecture overlay is shown */}
        {viewLecture && lectureId && (
          <button
            type="button"
            title="Refresh summary"
            aria-label="Refresh summary"
            onClick={() => window.dispatchEvent(new CustomEvent("lecture:regenerate"))}
            className={[
              "h-[36px] w-[36px] rounded-lg border flex items-center justify-center cursor-pointer transition",
              "bg-green-50 border-green-200 hover:bg-green-100 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300/50",
            ].join(" ")}
          >
            <img src="/icons/refresh.svg" alt="" className="h-4 w-4 opacity-90" aria-hidden="true" />
          </button>
        )}

        {NAV.map(({ key, icon, title }) => {
          const active = isActive(key);
          const base =
            "relative h-[36px] w-[36px] rounded-lg border flex items-center justify-center cursor-pointer transition";
          const inactive =
            "bg-white border-gray-300 hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10";
          const activeCls =
            "bg-gray-100 border-gray-900 shadow-sm ring-1 ring-black/5";

          return (
            <button
              key={key}
              onClick={() => go(key)}
              title={title}
              aria-label={title}
              aria-current={active ? "page" : undefined}
              className={[base, active ? activeCls : inactive].join(" ")}
            >
              <img
                src={icon}
                alt=""
                className={["h-4 w-4", active ? "opacity-100" : "opacity-80"].join(" ")}
                aria-hidden="true"
              />
              {/* recording status dot */}
              {key === "record" && recActive && (
                <span className="absolute top-1 right-1 inline-block h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* RECORDING view */}
      {tab === "record" && <RecorderPanel />}

      {/* CHAT view */}
      {tab === "chat" && <ClassChat classId={classId} classTitle={classTitle || "Class"} />}

      {/* SETTINGS view */}
      {tab === "class" && <ClassSettingsPanel classId={classId} />}

      {/* SUMMARY OVERLAY */}
      {viewLecture && lectureId && (
        <div className="absolute inset-0 z-20 bg-white">
          <LectureSummaryPage lectureId={lectureId} classId={classId} />
        </div>
      )}
    </div>
  );
}
