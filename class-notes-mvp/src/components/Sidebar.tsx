"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();
  const accountHref = isSignedIn ? "/account" : "/auth/signin";

  const initial = useMemo(() => (displayName?.[0] || "U").toUpperCase(), [displayName]);

  useEffect(() => {
    fetch("/api/classes")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setClasses(data) : setClasses([])))
      .catch(() => {});
  }, []);

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
          <button className="p-2 rounded hover:bg-white" title="Start Recording">
            <img src="/icons/mic.svg" alt="" className="w-6 h-6" />
          </button>
          <a href="/" className="p-2 rounded hover:bg-white" title="Dashboard">
            <img src="/icons/import.svg" alt="" className="w-6 h-6" />
          </a>
          <button className="p-2 rounded hover:bg-white" title="Ask AI">
            <img src="/icons/chat.svg" alt="" className="w-6 h-6" />
          </button>
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

      <nav className="px-4 pt-4 flex flex-col gap-2 text-sm">
        <button className="flex items-center gap-2 text-blue-600 font-medium" title="Not wired yet">
          <img src="/icons/mic.svg" alt="" className="w-5 h-5" />
          {label("Start Recording")}
        </button>

        <a href="/" className="flex items-center gap-2 text-gray-700">
          <img src="/icons/import.svg" alt="" className="w-5 h-5" />
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
            <div className="text-xs text-gray-500">{isSignedIn ? "Account" : "View / Sign in"}</div>
          </div>
        </a>
      </div>
    </aside>
  );
}
