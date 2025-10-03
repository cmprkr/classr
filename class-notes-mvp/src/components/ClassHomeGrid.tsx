// src/components/ClassHomeGrid.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

type LectureLite = {
  id: string;
  originalName?: string | null;
  createdAt?: string | Date;
  keyTermsJson?: unknown;
};

function normalizeTerms(v: unknown): string[] {
  let arr: unknown = v;
  if (typeof arr === "string") {
    try { arr = JSON.parse(arr); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) return [];
  return Array.from(
    new Set(
      arr
        .map((t) =>
          String(t ?? "")
            .replace(/^['"`\\]+|['"`\\]+$/g, "")
            .trim()
        )
        .filter(Boolean)
    )
  ).slice(0, 14);
}

const normTerm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export default function ClassHomeGrid({
  classId,
  classTitle,
  lectures,
}: {
  classId: string;
  classTitle: string;
  lectures: LectureLite[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<any>(null);

  const hasLectures = (lectures?.length ?? 0) > 0;

  // Build nodes + edges only when we have lectures
  const elements = useMemo(() => {
    if (!hasLectures) return [];
    const nodes: any[] = [];
    const edges: any[] = [];
    const sameTermBuckets: Record<string, string[]> = {};

    nodes.push({
      data: { id: "class", label: classTitle || "Class", kind: "class" },
      position: { x: 0, y: 0 },
      locked: true,
      selectable: true,
    });

    for (const lec of lectures || []) {
      const lecId = `lec:${lec.id}`;

      nodes.push({
        data: { id: lecId, label: lec.originalName || "Untitled lecture", kind: "lecture", lectureId: lec.id },
      });

      edges.push({
        data: { id: `e:${lecId}->class`, source: lecId, target: "class", etype: "L" },
      });

      for (const t of normalizeTerms(lec.keyTermsJson)) {
        const kwId = `kw:${lec.id}:${t}`;
        nodes.push({ data: { id: kwId, label: t, kind: "keyword", lectureId: lec.id } });
        edges.push({ data: { id: `e:${lecId}->${kwId}`, source: lecId, target: kwId, etype: "K" } });

        const key = normTerm(t);
        (sameTermBuckets[key] ||= []).push(kwId);
      }
    }

    for (const [term, ids] of Object.entries(sameTermBuckets)) {
      if (ids.length > 1) {
        for (let i = 0; i < ids.length - 1; i++) {
          edges.push({
            data: { id: `kwkw:${term}:${i}`, source: ids[i], target: ids[i + 1], etype: "KWKW" },
          });
        }
      }
    }

    return [...nodes, ...edges];
  }, [hasLectures, classTitle, lectures]);

  // Initialize Cytoscape only when there are lectures
  useEffect(() => {
    if (!hasLectures) return;
    let cy: any;
    (async () => {
      const cytoscape = (await import("cytoscape")).default;
      const fcose = (await import("cytoscape-fcose")).default;
      cytoscape.use(fcose);

      cy = cytoscape({
        container: containerRef.current!,
        elements,
        wheelSensitivity: 0.35,
        minZoom: 0.2,
        maxZoom: 4,
        style: [
          // base edges
          { selector: "edge", style: { "curve-style": "straight", "line-color": "#d7ddff", width: 1.2, opacity: 0.9 } },
          // keyword↔keyword (same term)
          { selector: 'edge[etype = "KWKW"]', style: { "curve-style": "straight", "line-color": "#f9d6ee", "line-style": "dashed", width: 1.6, opacity: 0.95 } },
          // base node style
          {
            selector: "node",
            style: {
              shape: "round-rectangle",
              "border-width": 1,
              color: "#111827",
              "text-valign": "center",
              "text-halign": "center",
              "font-family": "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
              label: "data(label)",
              padding: "6px",
              "text-wrap": "wrap",
              "text-overflow-wrap": "anywhere",
              width: "label",
              height: "label",
            },
          },
          // CLASS node — brand blend
          {
            selector: 'node[kind = "class"]',
            style: {
              "background-fill": "linear-gradient",
              "background-gradient-stop-colors": "#b8c5fe #f3c2e7",
              "background-gradient-direction": "to-bottom-right",
              "background-opacity": 1,
              "font-size": 16,
              "text-max-width": 240,
              padding: "8px",
              "border-color": "#a9b6fb",
            },
          },
          // LECTURE node — bluer
          {
            selector: 'node[kind = "lecture"]',
            style: {
              "background-fill": "linear-gradient",
              "background-gradient-stop-colors": "#a8b8fd #dcd3ff",
              "background-gradient-direction": "to-right",
              "background-opacity": 1,
              "font-size": 14,
              "text-max-width": 220,
              padding: "7px",
              "border-color": "#97a9fb",
            },
          },
          // KEYWORD node — pinker
          {
            selector: 'node[kind = "keyword"]',
            style: {
              "background-fill": "linear-gradient",
              "background-gradient-stop-colors": "#ffd8f0 #fccfea",
              "background-gradient-direction": "to-top-right",
              "background-opacity": 1,
              "font-size": 12,
              "text-max-width": 200,
              padding: "6px",
              "border-color": "#f3c7e6",
            },
          },
          { selector: "node:hover", style: { "background-opacity": 0.95 } },
        ],
        layout: {
          name: "fcose",
          quality: "proof",
          randomize: true,
          animate: false,
          nodeDimensionsIncludeLabels: true,
          uniformNodeDimensions: false,
          packComponents: true,
          nodeRepulsion: 20000,
          nodeSeparation: 140,
          idealEdgeLength: 190,
          edgeElasticity: 0.18,
          gravity: 0.25,
          gravityRange: 4.0,
          tile: true,
        } as any,
      });

      cyRef.current = cy;
      cy.fit(undefined, 40);

      setTimeout(() => {
        cy.layout({
          name: "fcose",
          quality: "default",
          randomize: false,
          animate: true,
          animationDuration: 450,
          nodeDimensionsIncludeLabels: true,
          packComponents: true,
          nodeRepulsion: 30000,
          nodeSeparation: 180,
          idealEdgeLength: 210,
          edgeElasticity: 0.2,
          gravity: 0.22,
          gravityRange: 4.2,
          tile: true,
        } as any).run();
      }, 60);

      cy.on("tap", 'node[kind = "lecture"]', (evt: any) => {
        const id = evt.target.data("lectureId");
        if (id) router.push(`/class/${classId}?view=lecture&lectureId=${encodeURIComponent(id)}`);
      });
    })();

    return () => {
      try { cyRef.current?.destroy(); } catch {}
    };
  }, [hasLectures, elements, classId, router]);

  // --- RENDER ---
  if (!hasLectures) {
    return (
      <div className="h-full w-full relative bg-transparent">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-sm sm:text-base text-gray-800">
            Knowledge graph will appear here after first upload.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative bg-transparent">
      <div className="px-4 pt-4 relative z-[1]">
        <h2 className="inline-block text-sm font-medium text-gray-800 bg-white/70 rounded-md px-2 py-1 shadow">
          Knowledge graph
        </h2>
      </div>
      <div ref={containerRef} className="h-[calc(100%-60px)] w-full relative z-[1]" />
    </div>
  );
}
