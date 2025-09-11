"use client";
import { useEffect, useState } from "react";

export default function ClassChat({ classId }:{ classId:string }) {
  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  async function load() {
    const c = await fetch(`/api/classes/${classId}`).then(r=>r.json());
    setHistory(c.chats || []);
  }
  useEffect(()=>{ load(); },[classId]);

  async function send() {
    if (!msg.trim()) return;
    setHistory(h=>[...h, { role:"user", content: msg, createdAt: new Date().toISOString() }]);
    const text = msg; setMsg("");
    const r = await fetch(`/api/classes/${classId}/chat`, {
      method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ message: text })
    });
    const data = await r.json();
    setHistory(h=>[...h, { role:"assistant", content: data.answer, citations: data.citations, createdAt: new Date().toISOString() }]);
  }

  return (
    <div className="rounded-2xl border bg-white p-4 space-y-3">
      <div className="h-80 overflow-auto space-y-3">
        {history.map((m,i)=>(
          <div key={i} className={m.role==="user"?"text-right":""}>
            <div className={`inline-block max-w-[80%] rounded-xl px-3 py-2 ${
                m.role==="user" ? "bg-black text-white" : "bg-gray-100 text-gray-900"
                }`}>
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.citations && (
                    <div className="text-xs text-gray-700 mt-1">
                    Cites: {m.citations.length} chunks
                    </div>
                )}
                </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Ask about this class…"
               className="border rounded-lg px-3 py-2 w-full"/>
        <button onClick={send} className="px-4 py-2 rounded-lg bg-black text-white">Send</button>
      </div>
    </div>
  );
}
