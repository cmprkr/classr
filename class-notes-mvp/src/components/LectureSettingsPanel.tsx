// src/components/LectureSettingsPanel.tsx
"use client";
import { useEffect, useState } from "react";

type Lec = { id: string; originalName: string; kind: string };

export default function LectureSettingsPanel({
  lectureId,
  onClose,
  embedded = false, // ⬅️ NEW
}: {
  lectureId: string;
  onClose?: () => void;
  embedded?: boolean; // ⬅️ NEW
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  const resourceTypes = [
    "LECTURE",
    "SLIDESHOW",
    "NOTES",
    "HANDOUT",
    "GRADED_ASSIGNMENT",
    "UNGRADED_ASSIGNMENT",
    "GRADED_TEST",
    "OTHER",
  ];

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      setIsLocked(false);
      try {
        const r = await fetch(`/api/lectures/${lectureId}`);
        if (!r.ok) {
          const errorText = await r.text();
          if (r.status === 403 || errorText.includes("not own") || errorText.includes("unauthorized")) {
            if (mounted) {
              setIsLocked(true);
              setError("This lecture is locked because you do not own it.");
              const data = await r.json().catch(() => ({}));
              if (data.originalName) setName(data.originalName);
              if (data.kind) setKind(data.kind);
            }
          } else {
            throw new Error(errorText || "Unknown error");
          }
        } else {
          const data = (await r.json()) as Lec;
          if (mounted) {
            setName(data.originalName || "");
            setKind(data.kind || "LECTURE");
          }
        }
      } catch (e: any) {
        if (mounted && !isLocked) setError(`Failed to load lecture details: ${e.message}`);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lectureId]);

  async function save() {
    if (isLocked) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/lectures/${lectureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalName: name, kind }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "Save failed");
      }
      onClose?.();
    } catch (e: any) {
      setError(
        `Save failed: ${e.message}. If this keeps happening, ensure PATCH /api/lectures/[lectureId] accepts { originalName, kind }.`
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (isLocked || deleting) return;
    if (!confirm("Delete this lecture? This cannot be undone.")) return;
    setDeleting(true);
    setError(null);
    try {
      const r = await fetch(`/api/lectures/${lectureId}`, { method: "DELETE" });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "Delete failed");
      }
      onClose?.();
    } catch (e: any) {
      setError(`Delete failed: ${e.message}. If this keeps happening, ensure DELETE /api/lectures/[lectureId] is implemented.`);
    } finally {
      setDeleting(false);
    }
  }

  // ⬇️ Two render modes: full-page (existing) and embedded (inline card)
  if (embedded) {
    return (
      <div className="w-full">
        <div className="rounded-xl bg-white shadow ring-1 ring-black/5 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Lecture settings</h2>
            {onClose && (
              <button onClick={onClose} className="text-xs px-2 py-1 rounded border">
                Close
              </button>
            )}
          </div>
          {loading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-gray-700 mb-1">File name</label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLocked}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {isLocked
                    ? "You cannot edit this lecture because you do not own it."
                    : "This changes how the item appears in your list."}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Type</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  disabled={isLocked}
                  className="w-full rounded-lg border px-3 py-2 text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {resourceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-gray-500 mt-1">
                  {isLocked ? "You cannot change the type because you do not own this lecture." : "Select the type."}
                </div>
              </div>
              {error && <div className="text-sm text-red-600">{error}</div>}
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={!name.trim() || saving || isLocked}
                  className="px-3 py-2 rounded-lg bg-black text-white text-sm disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={remove}
                  disabled={isLocked || deleting}
                  className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                {onClose && (
                  <button onClick={onClose} className="px-3 py-2 rounded-lg border text-sm">
                    Cancel
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // original full-screen panel
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
                    className="w-full rounded-lg border px-3 py-2 text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLocked}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {isLocked
                      ? "You cannot edit this lecture because you do not own it."
                      : "This changes how the item appears in your list."}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Type</label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    disabled={isLocked}
                    className="w-full rounded-lg border px-3 py-2 text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {resourceTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-500 mt-1">
                    {isLocked
                      ? "You cannot change the type because you do not own this lecture."
                      : "Select the type of this lecture or resource."}
                  </div>
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <div className="flex gap-2">
                  <button
                    onClick={save}
                    disabled={!name.trim() || saving || isLocked}
                    className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={remove}
                    disabled={isLocked || deleting}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete"}
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
