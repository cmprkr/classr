"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Klass = { id: string; name: string };

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
  const [openAll, setOpenAll] = useState(true);
  const [recActive, setRecActive] = useState(false); // recording indicator
  const pathname = usePathname();
  const router = useRouter();
  const accountHref = isSignedIn ? "/account" : "/auth/signin";

  const initial = useMemo(
    () => (displayName?.[0] || "U").toUpperCase(),
    [displayName]
  );

  // Load classes for nav
  useEffect(() => {
    fetch("/api/classes")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setClasses(data) : setClasses([])))
      .catch(() => {});
  }, []);

  // Sync recording indicator with RecorderPanel (via CustomEvent + sessionStorage)
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
    storageSync(); // initialize from session
    return () => {
      window.removeEventListener("rec:active", handler as EventListener);
      window.removeEventListener("storage", storageSync);
    };
  }, []);

  function goToRecorder() {
    // Case 1: already inside a class
    const m = pathname?.match(/^\/class\/([^\/?#]+)/);
    if (m) {
      router.push(`/class/${m[1]}?record=1`);
      return;
    }
    // Case 2: on dashboard
    if (pathname === "/") {
      router.push("/?record=1");
      return;
    }
    // Case 3: fallback to first class if available
    if (classes.length) {
      router.push(`/class/${classes[0].id}?record=1`);
    } else {
      alert("Create a class first to attach your recording.");
    }
  }

  const W = collapsed ? "w-16" : "w-64";
  const label = (text: string) =>
    collapsed ? <span className="sr-only">{text}</span> : <span>{text}</span>;

  // Collapsed
  if (collapsed) {
    return (
      <aside
        className={`${W} transition-all duration-200 bg-gray-100 border-r border-gray-200 h-full flex flex-col`}
        aria-label="Collapsed sidebar"
      >
        <div className="h-12 flex items-center justify-center border-b">
          <button
            onClick={() => setCollapsed(false)}
            className="text-gray-700 hover:text-black"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <img src="/icons/chevron-right.svg" alt="expand" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-2">
          {/* Start Recording */}
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

        <div className="border-t pb-4 flex items-center justify-center">
          <a href={accountHref} className="hover:opacity-90" aria-label={displayName}>
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt="Avatar" className="w-8 h-8 rounded-full object-cover border" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 grid place-items-center text-xs font-semibold text-black border">
                {initial}
              </div>
            )}
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
      <div className="h-12 flex items-center justify-between border-b px-4">
        <div className="text-2xl font-bold text-gray-800">PROD1</div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-gray-700 hover:text-black"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <img src="/icons/chevron-left.svg" alt="collapse" className="w-5 h-5" />
        </button>
      </div>

      {/* smaller vertical spacing between items */}
      <nav className="px-4 pt-4 flex flex-col gap-1 text-sm">
        {/* Start Recording */}
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

      <div className="px-4 mt-6 text-xs uppercase text-gray-500">Folders</div>
      <div className="mt-1 px-4">
        <div className="flex items-start">
          <button
            className="inline-flex items-center gap-2 text-left text-sm text-gray-700 hover:underline"
            onClick={() => setOpenAll((o) => !o)}
            aria-expanded={openAll}
          >
            <img
              src={openAll ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
              alt=""
              className="w-4 h-4"
            />
            <img src="/icons/folder.svg" alt="" className="w-4 h-4" />
            {label("All Classes")}
          </button>
        </div>

        {openAll && (
          <ul className="mt-2 pl-6 pr-1 space-y-1 overflow-y-auto max-h-[40vh]">
            {classes.map((c) => {
              const isActive = pathname === `/class/${c.id}`;
              return (
                <li key={c.id} className="pl-4">
                  <a
                    href={`/class/${c.id}`}
                    className={`text-sm ${
                      isActive
                        ? "text-blue-600 font-semibold"
                        : "text-gray-700 hover:text-gray-900 hover:underline"
                    } line-clamp-1`}
                    title={c.name}
                  >
                    {c.name}
                  </a>
                </li>
              );
            })}
            {classes.length === 0 && (
              <li className="text-sm text-gray-500 pl-4">No classes yet</li>
            )}
          </ul>
        )}
      </div>

      {/* Profile footer */}
      <div className="mt-auto border-t px-4 pb-4 pt-2 text-sm">
        <a href={accountHref} className="flex items-center gap-2 hover:underline">
          {userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
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
