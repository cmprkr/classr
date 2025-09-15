// src/components/ClassSettingsPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
// Adjust the import path if your alias differs
import { CLASS_LIST } from "data/universities/united_states/indiana/rose-hulman_institute_of_technology/classes";

type Klass = {
  id: string;
  name: string;
  syncEnabled?: boolean;
  syncKey?: string | null;
};

export default function ClassSettingsPanel({ classId }: { classId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncKey, setSyncKey] = useState<string>("");

  // preload: GET /api/classes/[classId]
  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const r = await fetch(`/api/classes/${classId}`);
        if (!r.ok) throw new Error(await r.text());
        const data = (await r.json()) as Klass;
        if (!mounted) return;
        setName(data.name || "");
        setSyncEnabled(Boolean(data.syncEnabled));
        setSyncKey((data.syncKey || "") as string);
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
        body: JSON.stringify({
          name: trimmed,
          syncEnabled,
          // only persist syncKey if sync is enabled; otherwise clear it
          syncKey: syncEnabled ? syncKey || null : null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());

      // If turning sync ON, tag all current class lectures with this syncKey
      if (syncEnabled && syncKey) {
        await fetch(`/api/classes/${classId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ syncKey }),
        });
      }
    } catch (e: any) {
      setError(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteClass() {
    if (!confirm("Delete this class and all its data? This cannot be undone.")) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/classes/${classId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      // go back to dashboard
      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Delete failed.");
      setSaving(false);
    }
  }

  const uniOptions = useMemo(
    () =>
      CLASS_LIST.map((c) => ({
        value: c.syncKey,
        label: `${c.code} — ${c.name}`,
      })),
    []
  );

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
                {/* Class name */}
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

                {/* Sync with University */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-900">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={syncEnabled}
                      onChange={(e) => setSyncEnabled(e.target.checked)}
                    />
                    Sync with University
                  </label>

                  {syncEnabled && (
                    <div className="pl-6">
                      <label className="block text-sm text-gray-700 mb-1">
                        Choose university class
                      </label>
                      <select
                        className="w-full rounded-lg border px-3 py-2 text-black"
                        value={syncKey}
                        onChange={(e) => setSyncKey(e.target.value)}
                      >
                        <option value="">Select…</option>
                        {uniOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        When enabled, your current and future lecture items in this class will be shared
                        under the selected university class. Other users who sync to the same class can
                        see those items.
                      </p>
                    </div>
                  )}
                </div>

                {error && <div className="text-sm text-red-600">{error}</div>}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={save}
                    disabled={!name.trim() || (syncEnabled && !syncKey) || saving}
                    className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>

                  <button
                    onClick={deleteClass}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg border border-red-600 text-red-700 hover:bg-red-50"
                  >
                    Delete class
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
