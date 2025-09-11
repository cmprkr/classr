// app/page.tsx
"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [classes, setClasses] = useState<any[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const r = await fetch("/api/classes");
    setClasses(await r.json());
  }
  useEffect(()=>{ load(); },[]);

  async function create() {
    if (!name.trim()) return;
    await fetch("/api/classes", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ name })
    });
    setName(""); load();
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">My Classes</h1>

      <div className="flex gap-2">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Add a class…"
               className="border rounded-lg px-3 py-2 w-full"/>
        <button onClick={create} className="px-4 py-2 rounded-lg bg-black text-white">Add</button>
      </div>

      <ul className="grid gap-3">
        {classes.map(c=>(
          <li key={c.id}>
            <a className="block rounded-xl border bg-white p-4 hover:shadow" href={`/class/${c.id}`}>
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-gray-700">{new Date(c.createdAt).toLocaleString()}</div>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
