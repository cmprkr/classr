//src/components/ClassSettingsPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Readonly data with `as const`
import institutions from "data/institutions";
type Institution = (typeof institutions)[number];

type UniClass = { code: string; name: string; syncKey: string };

type Klass = {
  id: string;
  name: string;
  syncEnabled?: boolean;
  syncKey?: string | null;
  scheduleJson?: any | null;
  isActive?: boolean;
};

// ---------- helpers ----------
function slugifyCountry(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function fetchClassList(country: string, primaryDomain: string): Promise<UniClass[]> {
  const qs = new URLSearchParams({
    country: slugifyCountry(country),
    domain: primaryDomain.toLowerCase(),
  });
  const r = await fetch(`/api/university-classes?${qs.toString()}`, { cache: "no-store" });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(txt || "Failed to load classes");
  }
  const data = (await r.json()) as { classes: UniClass[] };
  if (!Array.isArray(data?.classes)) throw new Error("Invalid classes payload");
  return data.classes;
}

async function loadClassListForInstitution(inst: Institution) {
  const domain = (inst.domains?.[0] || "").toLowerCase();
  if (!domain) throw new Error("No domain found for selected school.");

  const list = await fetchClassList(inst.country, domain);
  return list.map((c) => ({ value: c.syncKey, label: `${c.code} — ${c.name}` }));
}

/** Given a syncKey, find the institution whose class list contains it. */
async function resolveInstitutionBySyncKey(
  syncKey: string,
  insts: readonly Institution[]
): Promise<{ domain: string; options: { value: string; label: string }[] } | null> {
  for (const inst of insts) {
    const domain = (inst.domains?.[0] || "").toLowerCase();
    if (!domain) continue;
    try {
      const list = await fetchClassList(inst.country, domain);
      if (list.some((c) => c.syncKey === syncKey)) {
        return {
          domain,
          options: list.map((c) => ({ value: c.syncKey, label: `${c.code} — ${c.name}` })),
        };
      }
    } catch {
      // ignore and keep searching
    }
  }
  return null;
}

// ---------- schedule types & helpers ----------
type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
const ALL_DAYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ScheduleUniform = { start?: string; end?: string; timezone?: string };
type SchedulePerDay = Record<DayKey, { start?: string; end?: string }>;

type ClassSchedule =
  | { days: DayKey[]; mode: "uniform"; uniform?: ScheduleUniform }
  | { days: DayKey[]; mode: "per-day"; perDay?: SchedulePerDay };

function toClassSchedule(raw: any): ClassSchedule {
  const daysRaw = Array.isArray(raw?.days) ? raw.days : [];
  const days = daysRaw.filter((d: any): d is DayKey => ALL_DAYS.includes(d));
  if (raw?.mode === "per-day") {
    const per: SchedulePerDay = { Mon: {}, Tue: {}, Wed: {}, Thu: {}, Fri: {}, Sat: {}, Sun: {} };
    for (const d of days) {
      const ent = raw?.perDay?.[d] || {};
      per[d as DayKey] = {
        start: typeof ent.start === "string" ? ent.start : undefined,
        end: typeof ent.end === "string" ? ent.end : undefined,
      };
    }
    return { days, mode: "per-day", perDay: Object.keys(per).length ? per : undefined };
  }
  const uniform = {
    start: typeof raw?.uniform?.start === "string" ? raw.uniform.start : undefined,
    end: typeof raw?.uniform?.end === "string" ? raw.uniform.end : undefined,
    timezone:
      typeof raw?.uniform?.timezone === "string"
        ? raw.uniform.timezone
        : "America/Indiana/Indianapolis",
  };
  return { days, mode: "uniform", uniform };
}

function timeValid(v?: string) {
  return !!v && /^\d{2}:\d{2}$/.test(v);
}

// ---------- component ----------
export default function ClassSettingsPanel({ classId }: { classId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Back → MAIN PAGE (clear summary + tab/record params)
  function goBack() {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.delete("view");
    currentParams.delete("lectureId");
    currentParams.delete("tab");
    currentParams.delete("record");
    const qs = currentParams.toString();
    router.push(qs ? `/class/${classId}?${qs}` : `/class/${classId}`);
  }

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncKey, setSyncKey] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

  // NEW: user's default university domain (from /api/me)
  const [userDefaultUni, setUserDefaultUni] = useState<string>("");

  // school + dynamic classes
  const [selectedSchoolDomain, setSelectedSchoolDomain] = useState<string>("");
  const [classOptions, setClassOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);

  // schedule state
  const [days, setDays] = useState<Set<DayKey>>(new Set());
  const [sameTimeAll, setSameTimeAll] = useState(true);
  const [uniformStart, setUniformStart] = useState<string>("");
  const [uniformEnd, setUniformEnd] = useState<string>("");
  const [perDay, setPerDay] = useState<SchedulePerDay>({
    Mon: {},
    Tue: {},
    Wed: {},
    Thu: {},
    Fri: {},
    Sat: {},
    Sun: {},
  });

  // Load user default uni first (doesn't block class fetch)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/me");
        if (!r.ok) return;
        const me = await r.json();
        const dom = (me?.defaultUniversityDomain || "").toLowerCase();
        setUserDefaultUni(dom || "");
      } catch {}
    })();
  }, []);

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
        setIsActive((data as any).isActive ?? true);

        // schedule
        const sched = toClassSchedule(data.scheduleJson);
        setDays(new Set<DayKey>(sched.days || []));
        if (sched.mode === "per-day") {
          setSameTimeAll(false);
          const pd: SchedulePerDay = { Mon: {}, Tue: {}, Wed: {}, Thu: {}, Fri: {}, Sat: {}, Sun: {} };
          for (const d of ALL_DAYS) {
            pd[d] = { start: sched.perDay?.[d]?.start, end: sched.perDay?.[d]?.end };
          }
          setPerDay(pd);
        } else {
          setSameTimeAll(true);
          setUniformStart(sched.uniform?.start || "");
          setUniformEnd(sched.uniform?.end || "");
        }
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

  // When sync turns on and no school chosen yet, auto-fill from user default
  useEffect(() => {
    if (syncEnabled && !selectedSchoolDomain && userDefaultUni) {
      setSelectedSchoolDomain(userDefaultUni);
    }
  }, [syncEnabled, selectedSchoolDomain, userDefaultUni]);

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

        // keep existing class if still valid
        if (syncKey && !opts.some((o) => o.value === syncKey)) {
          setSyncKey("");
        }
      } catch (e: any) {
        if (!mounted) return;
        setClassesError(e?.message || "Could not load classes for the selected school.");
        setClassOptions([]);
      } finally {
        if (mounted) setLoadingClasses(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [syncEnabled, selectedSchoolDomain, syncKey]);

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
          setSelectedSchoolDomain(resolved.domain);
          setClassOptions(resolved.options);
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

  // UI handlers: days + per-day
  function toggleDay(d: DayKey) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next as Set<DayKey>;
    });
  }
  function setPerDayStart(d: DayKey, v: string) {
    setPerDay((prev) => ({ ...prev, [d]: { ...(prev[d] || {}), start: v } }));
  }
  function setPerDayEnd(d: DayKey, v: string) {
    setPerDay((prev) => ({ ...prev, [d]: { ...(prev[d] || {}), end: v } }));
  }

  function buildScheduleJson(): ClassSchedule {
    const selected = Array.from(days) as DayKey[];
    if (sameTimeAll) {
      return {
        days: selected,
        mode: "uniform",
        uniform: {
          start: uniformStart || undefined,
          end: uniformEnd || undefined,
          timezone: "America/Indiana/Indianapolis",
        },
      };
    }
    const per: SchedulePerDay = { Mon: {}, Tue: {}, Wed: {}, Thu: {}, Fri: {}, Sat: {}, Sun: {} };
    for (const d of ALL_DAYS) {
      if (!selected.includes(d)) continue;
      per[d] = {
        start: perDay[d]?.start || undefined,
        end: perDay[d]?.end || undefined,
      };
    }
    return { days: selected, mode: "per-day", perDay: per };
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const scheduleJson = buildScheduleJson();
      const r = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          syncEnabled,
          syncKey: syncEnabled ? (syncKey || null) : null,
          scheduleJson,
          isActive,
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

  // Validation pieces
  const daysSelected = days.size > 0;
  const timesValidStrict =
    sameTimeAll
      ? timeValid(uniformStart) && timeValid(uniformEnd)
      : Array.from(days).every((d) => timeValid(perDay[d]?.start) && timeValid(perDay[d]?.end));
  const scheduleReady = daysSelected && timesValidStrict;
  const timesValid =
    !daysSelected ||
    (sameTimeAll
      ? timeValid(uniformStart) && timeValid(uniformEnd)
      : Array.from(days).every((d) => timeValid(perDay[d]?.start) && timeValid(perDay[d]?.end)));
  const saveDisabled =
    !name.trim() ||
    saving ||
    (syncEnabled && (!selectedSchoolDomain || !syncKey || !scheduleReady));

  return (
    <section className="flex h-full w-full flex-col bg-white">
      {/* Header: Back button + thin divider */}
      <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-3">
        <button
          onClick={goBack}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-black hover:bg-gray-100 cursor-pointer"
        >
          Back
        </button>
        <h1 className="text-sm font-semibold text-black truncate">Settings</h1>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-6">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <>
            {/* Class name */}
            <div>
              <label className="block text-sm text-gray-700 mb-1">Class name</label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-black bg-white"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="text-xs text-gray-500 mt-1">
                This updates the class title everywhere.
              </div>
            </div>

            {/* Active status */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Currently taking this class
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Uncheck if this is past, paused, or dropped.
              </p>
            </div>

            {/* Sync with University */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={syncEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setSyncEnabled(next);
                    if (next && !selectedSchoolDomain && userDefaultUni) {
                      setSelectedSchoolDomain(userDefaultUni);
                    }
                    if (!next) {
                      setSelectedSchoolDomain("");
                      setSyncKey("");
                      setClassOptions([]);
                      setClassesError(null);
                    }
                  }}
                  disabled={!scheduleReady && !syncEnabled}
                  title={
                    !scheduleReady && !syncEnabled
                      ? "Set a schedule (days + valid start/end times) to enable sync"
                      : undefined
                  }
                />
                Sync with University
                {!scheduleReady && !syncEnabled && (
                  <span className="ml-2 rounded bg-yellow-100 text-yellow-800 px-2 py-0.5 text-xs">
                    requires schedule
                  </span>
                )}
              </label>

              {syncEnabled && (
                <div className="pl-0 sm:pl-2 space-y-4">
                  {/* Choose school */}
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Choose school</label>
                    <select
                      className="w-full rounded-lg border px-3 py-2 text-black bg-white"
                      value={selectedSchoolDomain}
                      onChange={(e) => {
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
                      Defaults to your Account preference if set. You can change it per class.
                    </p>
                  </div>

                  {/* Choose university class */}
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Choose university class</label>
                    <select
                      className="w-full rounded-lg border px-3 py-2 text-black bg-white disabled:opacity-50"
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

            {/* Schedule */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">Schedule</h3>

              {/* Days selector */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Days of the week</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_DAYS.map((d) => (
                    <label
                      key={d}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 ${
                        days.has(d) ? "bg-black text-white border-black" : "bg-white text-black"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={days.has(d)}
                        onChange={() => toggleDay(d)}
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>

              {/* Same-time toggle */}
              <label className="flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={sameTimeAll}
                  onChange={(e) => setSameTimeAll(e.target.checked)}
                />
                Same time for all selected days
              </label>

              {/* Times */}
              {sameTimeAll ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-0 sm:pl-2">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Start time</label>
                    <input
                      type="time"
                      value={uniformStart}
                      onChange={(e) => setUniformStart(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-black bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">End time</label>
                    <input
                      type="time"
                      value={uniformEnd}
                      onChange={(e) => setUniformEnd(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-black bg-white"
                    />
                  </div>
                  <p className="col-span-full text-xs text-gray-500">
                    Times are local to America/Indiana/Indianapolis.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pl-0 sm:pl-2">
                  {ALL_DAYS.filter((d) => days.has(d)).length === 0 ? (
                    <p className="text-sm text-gray-600">Select at least one day to set times.</p>
                  ) : (
                    ALL_DAYS.filter((d) => days.has(d)).map((d) => (
                      <div key={d} className="grid grid-cols-[80px_1fr_1fr] items-center gap-3">
                        <div className="text-sm font-medium text-gray-900">{d}</div>
                        <input
                          type="time"
                          value={perDay[d]?.start || ""}
                          onChange={(e) => setPerDayStart(d, e.target.value)}
                          className="rounded-lg border px-3 py-2 text-black bg-white"
                          placeholder="Start"
                        />
                        <input
                          type="time"
                          value={perDay[d]?.end || ""}
                          onChange={(e) => setPerDayEnd(d, e.target.value)}
                          className="rounded-lg border px-3 py-2 text-black bg-white"
                          placeholder="End"
                        />
                      </div>
                    ))
                  )}
                  <p className="text-xs text-gray-500">Times are local to America/Indiana/Indianapolis.</p>
                </div>
              )}

              {daysSelected && !timesValid && (
                <p className="text-xs text-red-600">Please enter start & end times for the selected day(s).</p>
              )}
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex flex-wrap items-center gap-2 pb-6">
              <button
                onClick={save}
                disabled={saveDisabled || (daysSelected && !timesValid)}
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
    </section>
  );
}
