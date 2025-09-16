// src/components/ClassSettingsPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// Readonly data with `as const`
import institutions from "data/institutions";
type Institution = (typeof institutions)[number];

type Klass = {
  id: string;
  name: string;
  syncEnabled?: boolean;
  syncKey?: string | null;
};

type UniClass = { code: string; name: string; syncKey: string };

// ---------- helpers ----------
function slugifyCountry(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// cache modules so we don't import the same file repeatedly
const classesModuleCache = new Map<string, Promise<any>>();

async function importClassesModule(country: string, primaryDomain: string) {
  const countrySlug = slugifyCountry(country);
  const domain = primaryDomain.toLowerCase();
  const path = `data/universities/${countrySlug}/${domain}/classes`;

  if (!classesModuleCache.has(path)) {
    classesModuleCache.set(
      path,
      import(/* @ts-ignore - dynamic segment */ path)
    );
  }
  return classesModuleCache.get(path)!;
}

async function loadClassListForInstitution(inst: Institution) {
  const domain = (inst.domains?.[0] || "").toLowerCase();
  if (!domain) throw new Error("No domain found for selected school.");

  const mod = await importClassesModule(inst.country, domain).catch(() => null);
  const list: UniClass[] | undefined = mod?.CLASS_LIST;
  if (!list) {
    throw new Error(
      `Classes not found at data/universities/${slugifyCountry(inst.country)}/${domain}/classes.`
    );
  }
  return list.map((c) => ({ value: c.syncKey, label: `${c.code} — ${c.name}` }));
}

/** Given a syncKey, find the institution whose CLASS_LIST contains it. */
async function resolveInstitutionBySyncKey(
  syncKey: string,
  insts: readonly Institution[]
): Promise<{ domain: string; options: { value: string; label: string }[] } | null> {
  for (const inst of insts) {
    const domain = (inst.domains?.[0] || "").toLowerCase();
    if (!domain) continue;
    try {
      const mod = await importClassesModule(inst.country, domain);
      const list = mod?.CLASS_LIST as UniClass[] | undefined;
      if (!list) continue;
      if (list.some((c) => c.syncKey === syncKey)) {
        return {
          domain,
          options: list.map((c) => ({ value: c.syncKey, label: `${c.code} — ${c.name}` })),
        };
      }
    } catch {
      // ignore; not every institution will have a classes file yet
    }
  }
  return null;
}

// ---------- component ----------
export default function ClassSettingsPanel({ classId }: { classId: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncKey, setSyncKey] = useState<string>("");

  // new: school + dynamic classes
  const [selectedSchoolDomain, setSelectedSchoolDomain] = useState<string>("");
  const [classOptions, setClassOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);

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
        const enabled = Boolean(data.syncEnabled);
        setSyncEnabled(enabled);
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

  // school options (unique by primary domain)
  const schoolOptions = useMemo(() => {
    const items = institutions
      .map((s) => {
        const domain = (s.domains?.[0] || "").toLowerCase();
        if (!domain) return null;
        return { value: domain, label: `${s.name} — ${domain}` };
      })
      .filter(Boolean) as Array<{ value: string; label: string }>;
    return items.sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  // when selecting a school while sync is enabled, load its classes
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!syncEnabled || !selectedSchoolDomain) {
        setClassOptions([]);
        setClassesError(null);
        return;
      }
      setLoadingClasses(true);
      setClassesError(null);

      try {
        const inst = institutions.find(
          (i) => (i.domains?.[0] || "").toLowerCase() === selectedSchoolDomain
        );
        if (!inst) throw new Error("Selected school not found.");
        const opts = await loadClassListForInstitution(inst);
        if (!mounted) return;
        setClassOptions(opts);

        // ✅ Keep the existing class if it's still valid for this school; otherwise clear it
        if (syncKey && !opts.some((o) => o.value === syncKey)) {
          setSyncKey("");
        }
      } catch (e: any) {
        if (!mounted) return;
        setClassesError(e?.message || "Could not load classes for the selected school.");
        setClassOptions([]);
        // don't touch syncKey here; user may still have a previous selection to preserve elsewhere
      } finally {
        if (mounted) setLoadingClasses(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [syncEnabled, selectedSchoolDomain]); // ← intentionally NOT clearing syncKey here

  // restore school + class from existing syncKey (on first load)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!syncEnabled || !syncKey || selectedSchoolDomain) return;

      setLoadingClasses(true);
      setClassesError(null);
      try {
        const resolved = await resolveInstitutionBySyncKey(syncKey, institutions);
        if (!mounted) return;

        if (resolved) {
          // This triggers the loader effect above, but we DO NOT clear syncKey there anymore
          setSelectedSchoolDomain(resolved.domain);
          setClassOptions(resolved.options);
          // syncKey already set; leave as-is so the class select shows it
        } else {
          setClassesError("Could not match saved class to a school. Please reselect the school.");
        }
      } catch (e: any) {
        if (mounted) setClassesError(e?.message || "Failed to restore school selection.");
      } finally {
        if (mounted) setLoadingClasses(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [syncEnabled, syncKey, selectedSchoolDomain]);

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
          syncKey: syncEnabled ? syncKey || null : null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());

      if (syncEnabled && syncKey) {
        await fetch(`/api/classes/${classId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ syncKey }),
        });
      }
      // keep selections; no state reset
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
      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Delete failed.");
      setSaving(false);
    }
  }

  const saveDisabled =
    !name.trim() ||
    saving ||
    (syncEnabled && (!selectedSchoolDomain || !syncKey));

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
                      onChange={(e) => {
                        setSyncEnabled(e.target.checked);
                        if (!e.target.checked) {
                          setSelectedSchoolDomain("");
                          setSyncKey("");
                          setClassOptions([]);
                          setClassesError(null);
                        }
                      }}
                    />
                    Sync with University
                  </label>

                  {syncEnabled && (
                    <div className="pl-6 space-y-4">
                      {/* 1) Choose school (by unique domain) */}
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Choose school
                        </label>
                        <select
                          className="w-full rounded-lg border px-3 py-2 text-black"
                          value={selectedSchoolDomain}
                          onChange={(e) => {
                            // This is a USER-initiated school change → clear the class
                            setSelectedSchoolDomain(e.target.value);
                            setSyncKey("");
                          }}
                        >
                          <option value="">Select a school…</option>
                          {schoolOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                          Schools are sourced from <code>/data/institutions.ts</code>. Uniqueness by domain.
                        </p>
                      </div>

                      {/* 2) Then choose a class */}
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Choose university class
                        </label>
                        <select
                          className="w-full rounded-lg border px-3 py-2 text-black disabled:opacity-50"
                          value={syncKey}
                          onChange={(e) => setSyncKey(e.target.value)}
                          disabled={!selectedSchoolDomain || loadingClasses || !!classesError}
                        >
                          <option value="">
                            {loadingClasses
                              ? "Loading classes…"
                              : classesError
                              ? "Unable to load classes"
                              : "Select…"}
                          </option>
                          {classOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>

                        {classesError ? (
                          <p className="text-xs text-red-600 mt-2">{classesError}</p>
                        ) : (
                          <p className="text-xs text-gray-500 mt-2">
                            When enabled, your current and future lecture items in this class will be
                            shared under the selected university class. Other users who sync to the same
                            class can see those items.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {error && <div className="text-sm text-red-600">{error}</div>}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={save}
                    disabled={saveDisabled}
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
