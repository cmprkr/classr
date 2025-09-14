// src/components/ClassChat.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function ClassChat({ classId }: { classId: string }) {
  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [isComposing, setIsComposing] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerH, setFooterH] = useState(0);

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

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    });
  }

  async function load() {
    const c = await fetch(`/api/classes/${classId}`).then((r) => r.json());
    setHistory(c.chats || []);
    scrollToBottom("auto");
  }

  useEffect(() => { load(); }, [classId]);
  useEffect(() => { if (history.length) scrollToBottom("smooth"); }, [history]);

  async function send() {
    const text = msg.trim();
    if (!text) return;

    setMsg("");
    setHistory((h) => [...h, { role: "user", content: text, createdAt: new Date().toISOString() }]);
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
        { role: "assistant", content: data.answer, citations: data.citations, createdAt: new Date().toISOString() },
      ]);
      scrollToBottom("smooth");
    } catch {
      setHistory((h) => [
        ...h,
        { role: "system", content: "Sorry—message failed to send.", createdAt: new Date().toISOString() },
      ]);
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
    // Fill entire column; remove outer card styling
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages area — no border/rounded boxing */}
      <div className="flex-1 min-h-0 overflow-auto px-4 pb-2">
        <div className="space-y-3">
          {history.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div key={i} className={isUser ? "text-right" : ""}>
                <div
                  className={[
                    "inline-block max-w-[80%] rounded-xl px-3 py-2 align-top",
                    isUser ? "bg-white border text-black" : "bg-gray-100 text-black",
                  ].join(" ")}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {m.citations && (
                    <div className="text-xs opacity-70 mt-1">Cites: {m.citations.length} chunks</div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} style={{ height: 1, scrollMarginBottom: footerH + 8 }} />
        </div>
      </div>

      {/* Composer — remove border lines so it feels full-bleed; keep slight padding */}
      <div ref={footerRef} className="bg-white px-4 pb-4 pt-2">
        <div className="flex gap-2">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={onKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder="Ask about this class..."
            className="border rounded-lg px-3 py-2 w-full bg-white text-black placeholder-gray-500"
          />
          <button onClick={send} className="px-4 py-2 rounded-lg bg-black text-white">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
