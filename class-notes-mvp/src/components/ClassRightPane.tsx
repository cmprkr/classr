// src/components/ClassRightPane.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import RecorderPanel from "@/components/RecorderPanel";
import Chat from "@/components/ClassChat";

export default function ClassRightPane({
  classId,
  initialTab = "chat",
  classTitle,
}: {
  classId: string;
  initialTab?: "chat" | "record";
  classTitle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<"chat" | "record">(initialTab);
  const [recActive, setRecActive] = useState(false);

  // 1) React to URL changes: sidebar sets ?record=1 -> switch to "record"
  useEffect(() => {
    const wantRecord = searchParams.get("record") === "1";
    setTab(wantRecord ? "record" : "chat");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // updates when the URL query changes

  // 2) Keep URL in sync when user clicks the toggle
  useEffect(() => {
    const wantRecord = tab === "record";
    const current = new URLSearchParams(searchParams.toString());
    const already = current.get("record") === "1";

    if (wantRecord && !already) {
      current.set("record", "1");
      router.replace(`${pathname}?${current.toString()}`, { scroll: false });
    } else if (!wantRecord && already) {
      current.delete("record");
      const qs = current.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Recording indicator from RecorderPanel (no change)
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

  return (
    <div className="relative h-full w-full">
      {/* Toggle pill (top-right) */}
      <div className="absolute right-4 top-4 z-20 rounded-lg border bg-white/80 backdrop-blur px-1 py-1 flex gap-1 shadow-sm">
        <button
          onClick={() => setTab("record")}
          className={`px-3 py-1 rounded-md text-sm ${
            tab === "record" ? "bg-black text-white" : "hover:bg-white"
          }`}
          title="Recording"
        >
          Recording
          {recActive && (
            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
          )}
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`px-3 py-1 rounded-md text-sm ${
            tab === "chat" ? "bg-black text-white" : "hover:bg-white"
          }`}
          title="Class chat"
        >
          Chat
        </button>
      </div>

      {/* RECORDING: full-bleed */}
      <div className={`${tab === "record" ? "block" : "hidden"} h-full w-full`}>
        <RecorderPanel />
      </div>

      {/* CHAT: full-bleed */}
      <div className={`${tab === "chat" ? "block" : "hidden"} h-full w-full`}>
        <div className="px-4 pt-4">
          {classTitle && (
            <h1 className="text-2xl font-semibold text-black">{classTitle}</h1>
          )}
        </div>
        <div className="h-[calc(100%-56px)] px-4 pb-4">
          <Chat classId={classId} />
        </div>
      </div>
    </div>
  );
}
