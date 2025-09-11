// components/Uploader.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function Uploader({ classId }: { classId: string }) {
  const [status, setStatus] = useState<"idle"|"uploading"|"done"|"error">("idle");
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setStatus("uploading");

    const data = new FormData();
    Array.from(files).forEach(f => data.append("file", f));

    const r = await fetch(`/api/classes/${classId}/upload`, { method: "POST", body: data });
    if (!r.ok) { setStatus("error"); return; }

    setStatus("done");
    // trigger server component re-render so the lectures list updates
    startTransition(() => router.refresh());
  }

  return (
    <div
      onDrop={(e)=>{ e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      onDragOver={(e)=>e.preventDefault()}
      className="rounded-2xl border border-dashed p-6 text-center bg-white"
    >
      <p className="mb-2 font-medium">Drag & drop MP3s here or choose files</p>
      <input type="file" accept="audio/*" multiple onChange={e=>handleFiles(e.target.files)} />
      <div className="mt-2 text-sm text-gray-900">Status: {status}</div>
    </div>
  );
}
