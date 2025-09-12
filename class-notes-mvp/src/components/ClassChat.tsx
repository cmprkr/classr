"use client";

import { useEffect, useRef, useState } from "react";

export default function ClassChat({ classId }: { classId: string }) {
  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [isComposing, setIsComposing] = useState(false);

  // Bottom sentinel + sticky footer refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerH, setFooterH] = useState(0);

  // Measure sticky footer height (resizes on breakpoint/zoom/content)
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

  // Scroll helper – always scrolls after paint
  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    });
  }

  async function load() {
    const c = await fetch(`/api/classes/${classId}`).then((r) => r.json());
    setHistory(c.chats || []);
    scrollToBottom("auto"); // jump on initial load
  }

  // Initial load / class change
  useEffect(() => {
    load();
  }, [classId]);

  // On any history change (send/receive), scroll smoothly
  useEffect(() => {
    if (history.length) scrollToBottom("smooth");
  }, [history]);

  async function send() {
    const text = msg.trim();
    if (!text) return;

    // Optimistic append
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
      scrollToBottom("smooth");
    } catch {
      setHistory((h) => [
        ...h,
        {
          role: "system",
          content: "Sorry—message failed to send.",
          createdAt: new Date().toISOString(),
        },
      ]);
      scrollToBottom("smooth");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Enter to send; Shift+Enter for newline; don’t interrupt IME
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      send();
    }
  }

  return (
    // Fill available height, messages scroll independently of sticky input
    <div className="flex h-full flex-col">
      {/* Scrollable messages (no fixed bottom padding) */}
      <div className="flex-1 overflow-auto space-y-3 rounded-xl border p-3 bg-white">
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
                  <div className="text-xs opacity-70 mt-1">
                    Cites: {m.citations.length} chunks
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {/* Bottom sentinel: scrolls just above the sticky input (no visible extra whitespace) */}
        <div
          ref={bottomRef}
          style={{ height: 1, scrollMarginBottom: footerH + 8 }} // +8px breathing room
        />
      </div>

      {/* Sticky input bar (can’t scroll offscreen) */}
      <div ref={footerRef} className="sticky bottom-0 bg-white pt-3">
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
