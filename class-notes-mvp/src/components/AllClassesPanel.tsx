// components/AllClassesPanel.tsx
"use client";
import { useEffect, useState } from "react";

type Klass = { id: string; name: string; createdAt: string };

export default function AllClassesPanel() {
  const [classes, setClasses] = useState<Klass[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function load() {
    const r = await fetch("/api/classes");
    if (r.status === 401) { setClasses([]); return; }
    setClasses(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    const r = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok) { setName(""); load(); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this class and all its data?")) return;
    await fetch(`/api/classes/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(c: Klass) {
    setEditingId(c.id);
    setEditingName(c.name);
  }

  async function saveEdit() {
    if (!editingId) return;
    const newName = editingName.trim();
    if (!newName) return;
    const r = await fetch(`/api/classes/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (r.ok) {
      setEditingId(null);
      setEditingName("");
      load();
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
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
        <button onClick={create} className="px-4 py-2 rounded-lg bg-black text-white">Add</button>
      </div>

      <div className="space-y-2">
        {classes.map((c) => {
          const isEditing = editingId === c.id;
          return (
            <div key={c.id} className="p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="border rounded px-2 py-1 w-full text-black"
                      autoFocus
                    />
                    <button onClick={saveEdit} className="px-2 py-1 rounded bg-black text-white text-xs">Save</button>
                    <button onClick={cancelEdit} className="px-2 py-1 rounded border text-xs">Cancel</button>
                  </div>
                ) : (
                  <a className="block" href={`/class/${c.id}`}>
                    <div className="text-sm font-semibold text-gray-900 line-clamp-1">{c.name}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {new Date(c.createdAt).toLocaleString()}
                    </div>
                  </a>
                )}
              </div>

              {!isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(c)}
                    className="p-2 rounded hover:bg-white"
                    title="Edit name"
                  >
                    <img src="/icons/pencil-edit.svg" alt="Edit" className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(c.id)}
                    className="p-2 rounded hover:bg-white"
                    title="Delete class"
                  >
                    <img src="/icons/folder-delete.svg" alt="Delete" className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
