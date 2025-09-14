"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LectureSettings({
  classId,
  lectureId,
  initialName,
}: {
  classId: string;
  lectureId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function save() {
    const newName = name.trim();
    if (!newName || newName === initialName) {
      // nothing to change; just "close"
      close();
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/lectures/${lectureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalName: newName }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(err?.error || "Failed to rename file");
      } else {
        close(); // go back to chat
      }
    } finally {
      setSaving(false);
    }
  }

  function close() {
    // remove ?lecture=... from URL -> back to chat
    router.push(`/class/${classId}`);
  }

  return (
    <section className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-pink-200" />
      <div className="relative h-full w-full flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5 p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-semibold text-gray-900">Lecture settings</h1>
              <button onClick={close} className="text-sm text-gray-700 hover:underline">
                Back to chat
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <div className="text-sm text-gray-700 mb-1">File name</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-black"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={close} className="rounded-lg border px-4 py-2">
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
