// src/components/LectureSettingsPanel.tsx
"use client";

import { useEffect, useState } from "react";

type Lec = { id: string; originalName: string };

export default function LectureSettingsPanel({
  lectureId,
  onClose,
  onRenamed,
}: {
  lectureId: string;
  onClose?: () => void;
  onRenamed?: (newName?: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  // Load lecture name
  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const r = await fetch(`/api/lectures/${lectureId}`);
        if (!r.ok) throw new Error(await r.text());
        const data = (await r.json()) as Lec;
        if (mounted) setName(data.originalName || "");
      } catch (e: any) {
        if (mounted) setError("Failed to load lecture details.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lectureId]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/lectures/${lectureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalName: name }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "Save failed");
      }
      onRenamed?.(name);
    } catch (e: any) {
      setError(
        "Save failed. If this keeps happening, ensure PATCH /api/lectures/[lectureId] accepts { originalName }."
      );
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
              <h1 className="text-2xl font-semibold text-gray-900">Lecture settings</h1>
              {onClose && (
                <button onClick={onClose} className="text-sm px-3 py-1 rounded-lg border">
                  Close
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">File name</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-black"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    This changes how the item appears in your list.
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
                  {onClose && (
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border">
                      Cancel
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
