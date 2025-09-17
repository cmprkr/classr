// class-notes-mvp/src/components/ClassChat.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ChatMsg = {
  role: "user" | "assistant" | "system";
  content: string;
  citations?: any;
  createdAt?: string;
  typing?: boolean; // local-only for UI
};

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
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [isComposing, setIsComposing] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerH, setFooterH] = useState(0);

  function goBack() {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.delete("view");
    currentParams.delete("lectureId");
    currentParams.delete("tab");
    currentParams.delete("record");
    const qs = currentParams.toString();
    router.push(qs ? `/class/${classId}?${qs}` : `/class/${classId}`);
  }

  // Sticky footer measurement
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
    // Expect shape: { id, name, chats: [...] }
    const chats = Array.isArray(c?.chats) ? c.chats : [];
    setHistory(
      chats.map((m: any) => ({
        role: m.role,
        content: m.content,
        citations: m.citations ? safeParse(m.citations) : undefined,
        createdAt: m.createdAt,
      }))
    );
    scrollToBottom("auto");
  }

  useEffect(() => {
    load();
  }, [classId]);

  useEffect(() => {
    if (history.length) scrollToBottom("smooth");
  }, [history]);

  function safeParse(x: any) {
    if (typeof x === "string") {
      try { return JSON.parse(x); } catch { return undefined; }
    }
    return x;
  }

  async function send() {
    const text = msg.trim();
    if (!text) return;

    // optimistic user message
    setMsg("");
    setHistory((h) => [
      ...h,
      { role: "user", content: text, createdAt: new Date().toISOString() },
    ]);

    // add typing placeholder (assistant)
    setHistory((h) => [
      ...h,
      { role: "assistant", content: "", typing: true, createdAt: new Date().toISOString() },
    ]);
    scrollToBottom("smooth");

    try {
      const r = await fetch(`/api/classes/${classId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await r.json();

      // replace the current typing bubble with the real assistant message
      setHistory((h) => {
        const idx = h.findIndex((m) => m.typing && m.role === "assistant");
        if (idx >= 0) {
          const next = h.slice();
          next[idx] = {
            role: "assistant",
            content: data.answer,
            citations: data.citations,
            createdAt: new Date().toISOString(),
          };
          return next;
        }
        // fallback: append if somehow not found
        return [
          ...h,
          {
            role: "assistant",
            content: data.answer,
            citations: data.citations,
            createdAt: new Date().toISOString(),
          },
        ];
      });
    } catch {
      // replace typing bubble with error
      setHistory((h) => {
        const idx = h.findIndex((m) => m.typing && m.role === "assistant");
        const errorMsg: ChatMsg = {
          role: "system",
          content: "Sorry—message failed to send.",
          createdAt: new Date().toISOString(),
        };
        if (idx >= 0) {
          const next = h.slice();
          next[idx] = errorMsg;
          return next;
        }
        return [...h, errorMsg];
      });
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
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-3">
        <button
          onClick={goBack}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-black hover:bg-gray-100 cursor-pointer"
        >
          Back
        </button>
        <h1 className="text-sm font-semibold text-black truncate">Chat</h1>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-auto space-y-3 px-4 py-3">
        {history.map((m, i) => {
          const isUser = m.role === "user";
          const isTyping = !!m.typing && m.role === "assistant";
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
                {isTyping ? (
                  <div className="flex items-center gap-1">
                    <span className="sr-only">Assistant is typing…</span>
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                ) : (
                  <>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {m.citations && (
                      <div className="text-xs opacity-70 mt-1">
                        Cites: {m.citations.length} chunks
                      </div>
                    )}
                  </>
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

      {/* local styles for typing dots */}
      <style jsx>{`
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: rgba(0, 0, 0, 0.6);
          display: inline-block;
          animation: bounce 1.2s infinite ease-in-out;
        }
        .dot:nth-child(1) { animation-delay: 0s; }
        .dot:nth-child(2) { animation-delay: 0.15s; }
        .dot:nth-child(3) { animation-delay: 0.3s; }

        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </section>
  );
}
