"use client";
import { useState } from "react";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null);
    const r = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ name, email, password }),
    });
    const j = await r.json();
    if (r.ok) setMsg("Account created. You can sign in now.");
    else setErr(j.error || "Failed to create account");
  }

  return (
    <div className="w-full flex items-center justify-center">
      <form onSubmit={onSubmit} className="max-w-sm w-full p-6 space-y-4">
        <h1 className="text-xl font-semibold">Create account</h1>
        <input className="w-full border rounded px-3 py-2" value={name} onChange={e=>setName(e.target.value)} placeholder="Name"/>
        <input className="w-full border rounded px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
        <input className="w-full border rounded px-3 py-2" value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password"/>
        {err && <div className="text-sm text-red-600">{err}</div>}
        {msg && <div className="text-sm text-green-700">{msg}</div>}
        <button className="w-full bg-black text-white rounded py-2">Create account</button>
      </form>
    </div>
  );
}
