"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Klass = {
  id: string;
  name: string;
  // pulled from /api/classes
  isActive?: boolean;
  scheduleJson?: any | null;
};

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
const ALL_DAYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ---------- schedule helpers (for Active Classes ordering) ---------- */
function isHHMM(v: any): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}
function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m; // 0..1439
}
/** Earliest start (minutes) from schedule, or null if none/invalid */
function earliestStartFromSchedule(s: any): number | null {
  if (!s || typeof s !== "object") return null;
  const days: DayKey[] = Array.isArray(s.days)
    ? (s.days.filter((d: any): d is DayKey => ALL_DAYS.includes(d)) as DayKey[])
    : [];

  if (s.mode === "per-day") {
    if (!s.perDay || typeof s.perDay !== "object" || days.length === 0) return null;
    const mins: number[] = [];
    for (const d of days) {
      const start = s.perDay?.[d]?.start;
      if (isHHMM(start)) mins.push(hhmmToMinutes(start));
    }
    return mins.length ? Math.min(...mins) : null;
  }

  const start = s?.uniform?.start;
  return isHHMM(start) ? hhmmToMinutes(start) : null;
}

/** Comparator for Active Classes only:
 * - classes WITH a valid schedule first, sorted by earliest start
 * - then classes WITHOUT a schedule, sorted alphabetically
 */
function compareWithinActive(a: Klass, b: Klass): number {
  const aStart = earliestStartFromSchedule(a.scheduleJson);
  const bStart = earliestStartFromSchedule(b.scheduleJson);

  const aHas = aStart !== null;
  const bHas = bStart !== null;

  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;
  if (aHas && bHas) {
    if (aStart! !== bStart!) return aStart! - bStart!;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export default function Sidebar({
  displayName,
  isSignedIn,
  userImage,
}: {
  displayName: string;
  isSignedIn: boolean;
  userImage: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [openActive, setOpenActive] = useState(true);
  const [openAll, setOpenAll] = useState(true);
  const [recActive, setRecActive] = useState(false);

  // vertical guide positions for both folders
  const [guideLeftActive, setGuideLeftActive] = useState<number>(34);
  const [guideLeftAll, setGuideLeftAll] = useState<number>(34);

  const pathname = usePathname();
  const router = useRouter();
  const accountHref = isSignedIn ? "/account" : "/auth/signin";

  // chevron + list wrapper refs for alignment
  const chevActiveRef = useRef<HTMLImageElement | null>(null);
  const wrapActiveRef = useRef<HTMLDivElement | null>(null);
  const chevAllRef = useRef<HTMLImageElement | null>(null);
  const wrapAllRef = useRef<HTMLDivElement | null>(null);

  const initial = useMemo(
    () => (displayName?.[0] || "U").toUpperCase(),
    [displayName]
  );

  // Load classes
  useEffect(() => {
    fetch("/api/classes")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setClasses(data) : setClasses([])))
      .catch(() => {});
  }, []);

  // Recording indicator sync
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as boolean;
      setRecActive(Boolean(detail));
      try {
        sessionStorage.setItem("recActive", detail ? "1" : "0");
      } catch {}
    };
    const storageSync = () => {
      try {
        setRecActive(sessionStorage.getItem("recActive") === "1");
      } catch {}
    };
    window.addEventListener("rec:active", handler as EventListener);
    window.addEventListener("storage", storageSync);
    storageSync();
    return () => {
      window.removeEventListener("rec:active", handler as EventListener);
      window.removeEventListener("storage", storageSync);
    };
  }, []);

  // Align vertical guides
  useEffect(() => {
    function calcGuide(
      chevRef: React.MutableRefObject<HTMLImageElement | null>,
      wrapRef: React.MutableRefObject<HTMLDivElement | null>,
      setter: (n: number) => void
    ) {
      const chev = chevRef.current;
      const wrap = wrapRef.current;
      if (!chev || !wrap) return;
      const cb = chev.getBoundingClientRect();
      const wb = wrap.getBoundingClientRect();
      const center = cb.left + cb.width / 2 - wb.left;
      setter(Math.max(0, Math.round(center)));
    }
    const update = () => {
      calcGuide(chevActiveRef, wrapActiveRef, setGuideLeftActive);
      calcGuide(chevAllRef, wrapAllRef, setGuideLeftAll);
    };
    update();
    window.addEventListener("resize", update);
    const id = requestAnimationFrame(update);
    return () => {
      window.removeEventListener("resize", update);
      cancelAnimationFrame(id);
    };
  }, [openActive, openAll]);

  function goToRecorder() {
    const m = pathname?.match(/^\/class\/([^\/?#]+)/);
    if (m) {
      router.push(`/class/${m[1]}?record=1`);
      return;
    }
    if (pathname === "/") {
      router.push("/?record=1");
      return;
    }
    if (classes.length) {
      router.push(`/class/${classes[0].id}?record=1`);
    } else {
      alert("Create a class first to attach your recording.");
    }
  }

  // Sorting
  const activeClasses = useMemo(
    () =>
      classes
        .filter((c) => c.isActive !== false) // default true
        .sort(compareWithinActive),
    [classes]
  );
  const allClassesAlpha = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [classes]
  );

  const W = collapsed ? "w-16" : "w-64";
  const label = (text: string) =>
    collapsed ? <span className="sr-only">{text}</span> : <span>{text}</span>;

  // Collapsed
  if (collapsed) {
    return (
      <aside
        className={`${W} transition-all duration-200 bg-gray-100 border-r border-gray-200 h-full flex flex-col`}
      >
        {/* Collapsed header — fixed height to match other panes */}
        <div className="flex justify-center">
          <div className="h-14 grid grid-cols-[1fr_auto] items-center py-8"></div>
          {/* invisible Back-sized placeholder to harmonize header height without shifting layout */}

          {/* expand chevron */}
          <button
            onClick={() => setCollapsed(false)}
            className="text-gray-700 hover:text-black justify-self-end"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <img src="/icons/chevron-right.svg" alt="expand" className="w-5 h-5" />
          </button>
        </div>

        {/* collapsed nav */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-2">
          <button
            className="relative p-2 rounded hover:bg-white cursor-pointer"
            title="Start Recording"
            onClick={goToRecorder}
          >
            <img src="/icons/mic.svg" alt="" className="w-6 h-6" />
            {recActive && (
              <span className="absolute -right-1 -top-1 inline-block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>
          <a href="/" className="p-2 rounded hover:bg-white" title="Dashboard">
            <img src="/icons/book.svg" alt="" className="w-6 h-6" />
          </a>
          <a href="/" className="p-2 rounded hover:bg-white" title="All Classes">
            <img src="/icons/folder.svg" alt="" className="w-6 h-6" />
          </a>
        </div>
      </aside>
    );
  }

  // Expanded
  return (
    <aside
      className={`${W} transition-all duration-200 bg-gray-100 border-r border-gray-200 flex flex-col h-full overflow-hidden`}
    >
{/* Top bar — reserve Back button space; left-align title */}
<div className="grid grid-cols-[auto_1fr_auto] items-center border-b border-gray-200 px-4 py-4">
  {/* Title (left-aligned) */}
  <div className="text-2xl font-bold text-gray-800 ml-2">classr</div>
  
  {/* Invisible spacer matching the Back button elsewhere */}
  <button
    aria-hidden
    tabIndex={-1}
    className="invisible px-4 py-2 rounded-lg border border-gray-300 text-sm"
  >
    Back
  </button>

  {/* Collapse chevron */}
  <button
    onClick={() => setCollapsed(true)}
    className="text-gray-700 hover:text-black justify-self-end"
    title="Collapse sidebar"
    aria-label="Collapse sidebar"
  >
    <img src="/icons/chevron-left.svg" alt="collapse" className="w-5 h-5" />
  </button>
</div>

      {/* Main nav */}
      <nav className="px-4 pt-4 flex flex-col gap-1 text-sm">
        <div
          className="relative flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-blue-600 font-medium hover:bg-white cursor-pointer"
          onClick={goToRecorder}
          title="Start Recording"
        >
          <div className="flex items-center gap-2">
            <img src="/icons/mic.svg" alt="" className="w-5 h-5" />
            {label("Start Recording")}
          </div>
          {recActive && (
            <span
              aria-label="Recording in progress"
              className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
            />
          )}
        </div>
        <a
          href="/"
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-gray-700 hover:bg-white cursor-pointer"
        >
          <img src="/icons/book.svg" alt="" className="w-5 h-5" />
          {label("Dashboard")}
        </a>
      </nav>

      {/* FOLDERS */}
      {/* Active Classes (NEW) */}
      <div className="px-4 pt-3">
        <button
          className="w-full flex items-center gap-2 rounded-lg px-2 py-1 text-gray-700 hover:bg-white text-sm"
          onClick={() => setOpenActive((o) => !o)}
          aria-expanded={openActive}
          title="Active Classes"
        >
          <img
            ref={chevActiveRef}
            src={openActive ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
            alt=""
            className="w-5 h-5"
          />
          <img src="/icons/folder.svg" alt="" className="w-5 h-5" />
          <span className="font-medium">Active Classes</span>
        </button>
      </div>
      {openActive && (
        <div ref={wrapActiveRef} className="mt-1 px-4 relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-300"
            style={{ left: `${guideLeftActive}px` }}
          />
          <ul className="pl-8 pr-2 space-y-1 overflow-y-auto max-h-[32vh]">
            {activeClasses.map((c) => {
              const isCurrent = pathname === `/class/${c.id}`;
              return (
                <li key={c.id}>
                  <a
                    href={`/class/${c.id}`}
                    title={c.name}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors ${
                      isCurrent
                        ? "bg-white text-blue-600 font-semibold"
                        : "text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <span>{c.name}</span>
                  </a>
                </li>
              );
            })}
            {activeClasses.length === 0 && (
              <li className="text-sm text-gray-500 px-2 py-1">No active classes</li>
            )}
          </ul>
        </div>
      )}

      {/* All Classes (alphabetical only) */}
      <div className="px-4 pt-3">
        <button
          className="w-full flex items-center gap-2 rounded-lg px-2 py-1 text-gray-700 hover:bg-white text-sm"
          onClick={() => setOpenAll((o) => !o)}
          aria-expanded={openAll}
          title="All Classes"
        >
          <img
            ref={chevAllRef}
            src={openAll ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
            alt=""
            className="w-5 h-5"
          />
          <img src="/icons/folder.svg" alt="" className="w-5 h-5" />
          <span className="font-medium">All Classes</span>
        </button>
      </div>
      {openAll && (
        <div ref={wrapAllRef} className="mt-1 px-4 relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-300"
            style={{ left: `${guideLeftAll}px` }}
          />
          <ul className="pl-8 pr-2 space-y-1 overflow-y-auto max-h-[32vh]">
            {allClassesAlpha.map((c) => {
              const isCurrent = pathname === `/class/${c.id}`;
              return (
                <li key={c.id}>
                  <a
                    href={`/class/${c.id}`}
                    title={c.name}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors ${
                      isCurrent
                        ? "bg-white text-blue-600 font-semibold"
                        : "text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <span>{c.name}</span>
                  </a>
                </li>
              );
            })}
            {allClassesAlpha.length === 0 && (
              <li className="text-sm text-gray-500 px-2 py-1">No classes yet</li>
            )}
          </ul>
        </div>
      )}

      {/* Profile footer */}
      <div className="mt-auto border-t px-4 pb-4 pt-2 text-sm">
        <a href={accountHref} className="flex items-center gap-2 hover:underline">
          {userImage ? (
            <img src={userImage} alt="Avatar" className="w-8 h-8 rounded-full object-cover border" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-300 grid place-items-center text-xs font-semibold text-black border">
              {initial}
            </div>
          )}
          <div>
            <div className="font-semibold text-black">{displayName}</div>
            <div className="text-xs text-gray-500">
              {isSignedIn ? "Account" : "View / Sign in"}
            </div>
          </div>
        </a>
      </div>
    </aside>
  );
}
