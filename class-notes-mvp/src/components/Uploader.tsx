//src/components/Uploader.tsx
"use client";

import { useRef, useState } from "react";

export default function Uploader({
  classId,
  onChanged,
}: { classId: string; onChanged?: () => void }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);

    if (!(fd.getAll("file") || []).length && !String(fd.get("manualText") || "").trim()) {
      setStatus("error");
      return;
    }

    setStatus("uploading");
    const r = await fetch(`/api/classes/${classId}/upload`, { method: "POST", body: fd });
    if (!r.ok) { setStatus("error"); return; }
    setStatus("done");
    onChanged?.();
    formRef.current.reset();
    setTimeout(() => setStatus("idle"), 700);
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-3 text-black">
      <label
        htmlFor="file"
        className="block rounded-lg border border-dashed p-4 text-center bg-white text-black"
      >
        <input
          id="file"
          name="file"
          type="file"
          multiple
          className="hidden"
          accept="
            audio/*,
            application/pdf,
            text/plain,.md,
            application/vnd.openxmlformats-officedocument.wordprocessingml.document,
            image/*"
        />
        <div className="font-medium text-black">Drag &amp; drop files here or choose files</div>
        <div className="text-xs mt-1 text-black">
          Supported: audio, images, PDF, TXT/MD, DOCX — or paste text below.
        </div>
      </label>

      <input
        name="descriptor"
        placeholder="e.g., Week 3 slides (optimization intro)"
        className="w-full rounded-lg border px-3 py-2 bg-white text-black placeholder-black"
      />

      <textarea
        name="manualText"
        placeholder="Paste an existing transcript or notes…"
        rows={4}
        className="w-full rounded-lg border px-3 py-2 bg-white text-black placeholder-black"
      />

      <div className="flex items-center justify-between">
        <div className="text-sm">
          Status: <span className="font-medium">{status}</span>
        </div>
        <button type="submit" className="rounded-lg bg-black px-4 py-2 text-white">
          Upload
        </button>
      </div>
    </form>
  );
}
