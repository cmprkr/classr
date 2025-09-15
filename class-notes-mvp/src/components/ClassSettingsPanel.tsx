// src/components/ClassSettingsPanel.tsx
"use client";

import { useEffect, useState } from "react";

type Klass = { id: string; name: string };

export default function ClassSettingsPanel({ classId }: { classId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  // Load class details
  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const r = await fetch(`/api/classes/${classId}`);
        if (!r.ok) throw new Error(await r.text());
        const data = (await r.json()) as Klass & { name?: string };
        if (mounted) setName(data.name || "");
      } catch {
        if (mounted) setError("Failed to load class details.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [classId]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!r.ok) throw new Error(await r.text());
    } catch (e: any) {
      setError("Save failed. Ensure PATCH /api/classes/[classId] accepts { name }.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-pink-200" />
      <div className="relative h-full w-full flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900">Class settings</h1>
            </div>

            {loading ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Class name</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-black"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    This updates the class title everywhere.
                  </div>
                </div>

                {error && <div className="text-sm text-red-600">{error}</div>}

                <div className="flex gap-2">
                  <button
                    onClick={save}
                    disabled={!name.trim() || saving}
                    className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
