// app/page.tsx
"use client";
import { useEffect, useState } from "react";

type Klass = { id: string; name: string; createdAt: string };

export default function Home() {
  const [classes, setClasses] = useState<Klass[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const r = await fetch("/api/classes");
    setClasses(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this class and all its data?")) return;
    await fetch(`/api/classes/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-black">My Classes</h1>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a class…"
          className="border rounded-lg px-3 py-2 w-full text-black placeholder:text-gray-500 bg-white"
        />
        <button onClick={create} className="px-4 py-2 rounded-lg bg-black text-white">
          Add
        </button>
      </div>

      <ul className="grid gap-3">
        {classes.map((c) => (
          <li key={c.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <a className="block flex-1 hover:underline" href={`/class/${c.id}`}>
                <div className="font-medium text-black">{c.name}</div>
                <div className="text-sm text-black">
                  {new Date(c.createdAt).toLocaleString()}
                </div>
              </a>
              <button
                onClick={() => remove(c.id)}
                className="shrink-0 rounded-lg px-3 py-1.5 bg-red-600 text-white text-sm"
                title="Delete class"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
