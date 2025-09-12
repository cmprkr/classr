// src/components/EventShield.tsx
"use client";

import { useEffect, useRef } from "react";

/**
 * Minimal guard:
 * - Only prevents default on <a href="#"> / empty href (stops "jump to top")
 * - Does NOT intercept input/change/click, so Save works normally
 */
export default function EventShield({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const blockHashAnchors = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href === "#" || href === "") {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    node.addEventListener("click", blockHashAnchors, true);
    return () => node.removeEventListener("click", blockHashAnchors, true);
  }, []);

  return <div ref={ref}>{children}</div>;
}
