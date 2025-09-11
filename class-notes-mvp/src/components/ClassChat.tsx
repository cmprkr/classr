"use client";

import { useEffect, useRef, useState } from "react";

export default function ClassChat({ classId }: { classId: string }) {
  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  async function load() {
    const c = await fetch(`/api/classes/${classId}`).then((r) => r.json());
    setHistory(c.chats || []);
  }
  useEffect(() => { load(); }, [classId]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [history]);

  async function send() {
    if (!msg.trim()) return;
    const text = msg;
    setMsg("");
    setHistory((h) => [...h, { role: "user", content: text, createdAt: new Date().toISOString() }]);
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
  }

  return (
    <div className="space-y-3">
      <div
        ref={listRef}
        className="h-80 overflow-auto space-y-3 rounded-xl border p-3 bg-white"
      >
        {history.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} className={isUser ? "text-right" : ""}>
              <div
                className={[
                  "inline-block max-w-[80%] rounded-xl px-3 py-2",
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
      </div>

      <div className="flex gap-2">
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Ask about this class..."
          className="border rounded-lg px-3 py-2 w-full bg-white text-black placeholder-gray-500"
        />
        <button onClick={send} className="px-4 py-2 rounded-lg bg-black text-white">
          Send
        </button>
      </div>
    </div>
  );
}
