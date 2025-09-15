// src/components/AllClassesPanel.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Klass = { id: string; name: string; createdAt: string; syncKey?: string | null };

export default function AllClassesPanel() {
  const router = useRouter();
  const [classes, setClasses] = useState<Klass[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const r = await fetch("/api/classes");
    if (r.status === 401) {
      setClasses([]);
      return;
    }
    setClasses(await r.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    const r = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      setName("");
      load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this class and all its data?")) return;
    await fetch(`/api/classes/${id}`, { method: "DELETE" });
    load();
  }

  function goToSettings(id: string) {
    router.push(`/class/${id}?tab=class`);
  }

  return (
    <section className="w-96 bg-white border-r overflow-y-auto p-4 space-y-3">
      <h2 className="text-lg font-semibold text-black border-b pb-2 mb-2">
        All Classes ({classes.length})
      </h2>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a class…"
          className="border rounded-lg px-3 py-2 w-full text-black placeholder:text-gray-500 bg-white"
        />
        <button type="button" onClick={create} className="px-4 py-2 rounded-lg bg-black text-white">
          Add
        </button>
      </div>
      <div className="space-y-2">
        {classes.map((c) => {
          const isSynced = !!c.syncKey;
          const cardBase = "p-3 rounded-lg border flex items-start justify-between gap-3";
          const syncedBg =
            "bg-gradient-to-r from-indigo-50 via-fuchsia-50 to-pink-50 hover:from-indigo-100 hover:via-fuchsia-100 hover:to-pink-100 border-fuchsia-200";
          const normalBg = "bg-gray-50 hover:bg-gray-100";

          return (
            <div
              key={c.id}
              className={`${cardBase} ${isSynced ? syncedBg : normalBg}`}
              title={isSynced ? "Synced class" : undefined}
            >
              <a className="flex-1 min-w-0 block" href={`/class/${c.id}`}>
                <div className="text-sm font-semibold text-gray-900 line-clamp-1">{c.name}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {new Date(c.createdAt).toLocaleString()}
                  {isSynced && (
                    <span className="inline-block rounded-full text-[10px] px-2 py-0.5 bg-pink-100 text-pink-700 border border-pink-200 ml-2">
                      Synced
                    </span>
                  )}
                </div>
              </a>
              <div className="flex items-center gap-1.5 self-center">
                <button
                  type="button"
                  onClick={() => goToSettings(c.id)}
                  className="p-2 rounded hover:bg-white"
                  title="Edit class (open settings)"
                  aria-label="Edit class"
                >
                  <img src="/icons/gear.svg" alt="" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="p-2 rounded hover:bg-white"
                  title="Delete class"
                  aria-label="Delete class"
                >
                  <img src="/icons/trash.svg" alt="" className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}