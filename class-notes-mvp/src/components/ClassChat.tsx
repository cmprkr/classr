// class-notes-mvp/src/components/ClassChat.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ClassChat({
  classId,
  classTitle,
}: {
  classId: string;
  classTitle: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [isComposing, setIsComposing] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerH, setFooterH] = useState(0);

  // Back button behavior matches LectureSummaryPage
  function goBack() {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.delete("view");
    currentParams.delete("lectureId");
    const qs = currentParams.toString();
    router.push(qs ? `/class/${classId}?${qs}` : `/class/${classId}`);
  }

  // Measure sticky footer
  useEffect(() => {
    if (!footerRef.current) return;
    const el = footerRef.current;
    const update = () => setFooterH(el.offsetHeight || 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    });
  };

  async function load() {
    const c = await fetch(`/api/classes/${classId}`).then((r) => r.json());
    setHistory(c.chats || []);
    scrollToBottom("auto");
  }

  useEffect(() => {
    load();
  }, [classId]);

  useEffect(() => {
    if (history.length) scrollToBottom("smooth");
  }, [history]);

  async function send() {
    const text = msg.trim();
    if (!text) return;
    setMsg("");
    setHistory((h) => [
      ...h,
      { role: "user", content: text, createdAt: new Date().toISOString() },
    ]);
    scrollToBottom("smooth");
    try {
      const r = await fetch(`/api/classes/${classId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await r.json();
      setHistory((h) => [
        ...h,
        {
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setHistory((h) => [
        ...h,
        {
          role: "system",
          content: "Sorry—message failed to send.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      scrollToBottom("smooth");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      send();
    }
  }

  return (
    <section className="flex h-full w-full flex-col bg-white">
      {/* Header (same style as LectureSummaryPage): Back button + thin divider */}
      <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-3">
        <button
          onClick={goBack}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-black hover:bg-gray-100 cursor-pointer"
        >
          Back
        </button>
        <h1 className="text-sm font-semibold text-black truncate">
          {classTitle} - Chat
        </h1>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-auto space-y-3 px-4 py-3">
        {history.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} className={isUser ? "text-right" : ""}>
              <div
                className={[
                  "inline-block max-w-[80%] rounded-xl px-3 py-2 align-top",
                  isUser
                    ? "bg-white border text-black"
                    : "bg-gray-100 text-black",
                ].join(" ")}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.citations && (
                  <div className="text-xs opacity-70 mt-1">
                    Cites: {m.citations.length} chunks
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div
          ref={bottomRef}
          style={{ height: 1, scrollMarginBottom: footerH + 8 }}
        />
      </div>

      {/* Sticky input */}
      <div
        ref={footerRef}
        className="sticky bottom-0 bg-white px-4 py-4 border-t flex items-center"
      >
        <div className="flex gap-2 w-full">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={onKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder="Ask about this class..."
            className="border rounded-lg px-3 py-2 w-full bg-white text-black placeholder-gray-500"
          />
          <button
            onClick={send}
            className="px-4 py-2 rounded-lg bg-black text-white"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}
