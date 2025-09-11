"use client";

import { useEffect, useState } from "react";

type Klass = { id: string; name: string };

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [openAll, setOpenAll] = useState(true);

  useEffect(() => {
    fetch("/api/classes")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? setClasses(data) : setClasses([]))
      .catch(() => {});
  }, []);

  const W = collapsed ? "w-16" : "w-64";
  const label = (text: string) =>
    collapsed ? <span className="sr-only">{text}</span> : <span>{text}</span>;

  if (collapsed) {
    // Collapsed: ONLY four centered icons; clicking anywhere expands
    return (
      <aside
        className={`${W} transition-all duration-200 bg-gray-100 border-r border-gray-200 p-2 h-full`}
        onClick={() => setCollapsed(false)}
        role="button"
        aria-label="Expand sidebar"
        title="Expand"
      >
        <div className="h-full flex flex-col items-center justify-center gap-6">
          <button className="p-2 rounded hover:bg-white" title="Start Recording">
            <img src="/icons/mic.svg" alt="" className="w-6 h-6" />
          </button>
          <a href="/" className="p-2 rounded hover:bg-white" title="Import Audio">
            <img src="/icons/import.svg" alt="" className="w-6 h-6" />
          </a>
          <button className="p-2 rounded hover:bg-white" title="Ask AI">
            <img src="/icons/chat.svg" alt="" className="w-6 h-6" />
          </button>
          <a href="/" className="p-2 rounded hover:bg-white" title="All Classes">
            <img src="/icons/folder.svg" alt="" className="w-6 h-6" />
          </a>
        </div>
      </aside>
    );
  }

  // Expanded view
  return (
    <aside className={`${W} transition-all duration-200 bg-gray-100 border-r border-gray-200 p-4 flex flex-col h-full relative overflow-hidden`}>
      {/* Collapse button (top-right) */}
      <button
        onClick={() => setCollapsed(true)}
        className="absolute top-3 right-3 inline-flex items-center justify-center rounded-md border px-2 py-1 bg-white hover:bg-gray-50 text-gray-800"
        title="Collapse sidebar"
      >
        <img src="/icons/chevron-left.svg" alt="collapse" className="w-4 h-4" />
      </button>

      {/* Brand */}
      <div className="text-2xl font-bold text-gray-800 pr-8">PROD1</div>

      {/* Primary actions (no emojis) */}
      <nav className="flex flex-col gap-2 text-sm mt-4">
        <button className="flex items-center gap-2 text-blue-600 font-medium" title="Not wired yet">
          <img src="/icons/mic.svg" alt="" className="w-5 h-5" />
          {label("Start Recording")}
        </button>

        <a href="/" className="flex items-center gap-2 text-gray-700">
          <img src="/icons/import.svg" alt="" className="w-5 h-5" />
          {label("Import Audio")}
        </a>

        <button className="flex items-center gap-2 text-gray-700" title="Not wired yet">
          <img src="/icons/chat.svg" alt="" className="w-5 h-5" />
          {label("Ask AI")}
          <span className="text-xs bg-yellow-300 px-1 rounded ml-1">Upgrade</span>
        </button>
      </nav>

      {/* FOLDERS tree */}
      <div className="text-xs uppercase text-gray-500 mt-6">Folders</div>

      <div className="mt-1">
        {/* Tree Node: All Classes */}
        <div className="flex items-start">
          <button
            className="inline-flex items-center gap-2 text-left text-sm text-blue-600 font-semibold hover:underline"
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

        {/* Children: class items */}
        {openAll && (
          <ul className="mt-2 pl-6 space-y-1 overflow-y-auto max-h-[40vh] pr-1">
            {classes.map((c) => (
              <li key={c.id}>
                <a
                  href={`/class/${c.id}`}
                  className="text-sm text-gray-700 hover:text-gray-900 hover:underline line-clamp-1"
                  title={c.name}
                >
                  {c.name}
                </a>
              </li>
            ))}
            {classes.length === 0 && (
              <li className="text-sm text-gray-500">No classes yet</li>
            )}
          </ul>
        )}
      </div>

      {/* Profile stub */}
      <div className="mt-auto border-t pt-4 text-sm">
        <a href="/account" className="flex items-center gap-2 hover:underline">
          <div className="w-8 h-8 bg-gray-400 rounded-full" />
          <div>
            <div className="font-semibold">Profile</div>
            <div className="text-xs text-gray-500">View / Sign in</div>
          </div>
        </a>
      </div>
    </aside>
  );
}
