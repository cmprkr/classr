// src/components/RecorderPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Klass = { id: string; name: string };

export default function RecorderPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Are we inside /class/[id]?
  const classMatch = pathname?.match(/^\/class\/([^\/?#]+)/);
  const inClassLayer = Boolean(classMatch?.[1]);
  const classIdInPath = classMatch?.[1] || "";

  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "paused" | "stopped">("idle");
  const [isUploading, setIsUploading] = useState(false);
  const [spinner, setSpinner] = useState("|");

  const chunks = useRef<BlobPart[]>([]);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const [filename, setFilename] = useState<string>(() =>
    `recording_${new Date().toISOString().replace(/[:.]/g, "-")}.webm`
  );
  const [classes, setClasses] = useState<Klass[]>([]);
  const [targetClassId, setTargetClassId] = useState<string>("");

  // ===== Timer (active record time; pause/resume aware) =====
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const accMsRef = useRef(0);
  const rafTimerRef = useRef<number | null>(null);

  function tickTimer() {
    const startedAt = startedAtRef.current;
    const nowMs = startedAt ? accMsRef.current + (Date.now() - startedAt) : accMsRef.current;
    setElapsedMs(nowMs);
    rafTimerRef.current = requestAnimationFrame(tickTimer);
  }
  function startTimer() {
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    if (rafTimerRef.current == null) rafTimerRef.current = requestAnimationFrame(tickTimer);
  }
  function pauseTimer() {
    if (startedAtRef.current) {
      accMsRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    if (rafTimerRef.current != null) {
      cancelAnimationFrame(rafTimerRef.current);
      rafTimerRef.current = null;
    }
    setElapsedMs(accMsRef.current);
  }
  function stopTimer() {
    pauseTimer();
  }
  function resetTimer() {
    pauseTimer();
    accMsRef.current = 0;
    setElapsedMs(0);
  }
  function formatTime(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
    const hh = String(h);
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${hh}:${mm}:${ss}` : `${m}:${ss}`;
  }

  // Audio visualization refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafVizRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const spinnerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to broadcast to Sidebar
  const setRecActive = (active: boolean) => {
    try {
      sessionStorage.setItem("recActive", active ? "1" : "0");
    } catch {}
    window.dispatchEvent(new CustomEvent("rec:active", { detail: active }));
  };

  useEffect(() => {
    setRecActive(false);
    return () => {
      setRecActive(false);
      if (spinnerIntervalRef.current) clearInterval(spinnerIntervalRef.current);
      stopVisualization();
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spinner animation
  useEffect(() => {
    if (isUploading) {
      const spinnerChars = ["|", "/", "-", "\\"];
      let index = 0;
      spinnerIntervalRef.current = setInterval(() => {
        setSpinner(spinnerChars[index]);
        index = (index + 1) % spinnerChars.length;
      }, 100);
    } else {
      if (spinnerIntervalRef.current) clearInterval(spinnerIntervalRef.current);
      setSpinner("|");
    }
    return () => {
      if (spinnerIntervalRef.current) clearInterval(spinnerIntervalRef.current);
    };
  }, [isUploading]);

  // Load classes
  useEffect(() => {
    fetch("/api/classes")
      .then((r) => r.json())
      .then((arr: Klass[]) => {
        const list = Array.isArray(arr) ? arr : [];
        setClasses(list);
        const idInPath = classMatch?.[1] || "";
        if (idInPath && list.some((c) => c.id === idInPath)) {
          setTargetClassId(idInPath);
        } else if (list.length && !targetClassId) {
          setTargetClassId(list[0].id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  function resetRecording() {
    stopVisualization();
    resetTimer();
    setBlob(null);
    setUrl(null);
    chunks.current = [];
    setState("idle");
    setRecActive(false);
  }

  function startVisualization(s: MediaStream) {
    stopVisualization();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const src = audioCtx.createMediaStreamSource(s);
    src.connect(analyser);

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    sourceRef.current = src;

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      analyser.getByteFrequencyData(dataArray);
      const barWidth = Math.max(2, Math.floor(width / bufferLength));
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i];
        const barHeight = (v / 255) * (height - 4);
        ctx.fillStyle = "#111827";
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
      rafVizRef.current = requestAnimationFrame(draw);
    };
    draw();
  }

  function stopVisualization() {
    if (rafVizRef.current) cancelAnimationFrame(rafVizRef.current);
    rafVizRef.current = null;
    try {
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect?.();
      audioCtxRef.current?.close?.();
    } catch {}
    sourceRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current = null;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(s);

      const rec = new MediaRecorder(s, { mimeType: "audio/webm" });
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        // finalize timer
        stopTimer();
        const b = new Blob(chunks.current, { type: rec.mimeType });
        setBlob(b);
        setState("stopped");
        setRecActive(false);
        s.getTracks().forEach((t) => t.stop());
        setStream(null);
        stopVisualization();
      };

      // reset + start
      chunks.current = [];
      resetTimer();
      rec.start();
      setRecorder(rec);
      setState("recording");
      setRecActive(true);
      startTimer();
      startVisualization(s);
    } catch {
      alert("Microphone access was blocked or unavailable.");
      setRecActive(false);
    }
  }

  function pauseRec() {
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      pauseTimer();
      setState("paused");
      setRecActive(false);
    }
  }

  function resumeRec() {
    if (!recorder) return;
    if (recorder.state === "paused") {
      recorder.resume();
      startTimer();
      setState("recording");
      setRecActive(true);
    }
  }

  function stopRec() {
    if (!recorder) return;
    if (recorder.state !== "inactive") {
      recorder.stop();
      setRecorder(null);
    }
  }

  async function uploadToClass() {
    if (!blob || !targetClassId) return;
    setIsUploading(true);
    const form = new FormData();
    const file = new File([blob], filename || "recording.webm", {
      type: blob.type || "audio/webm",
    });
    form.append("file", file);

    try {
      const r = await fetch(`/api/classes/${targetClassId}/upload`, {
        method: "POST",
        body: form,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(data?.error || "Upload failed.");
        return;
      }
      alert("Upload complete!");
      resetRecording();
    } catch {
      alert("Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  function downloadFile() {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = url!;
    a.download = filename || "recording.webm";
    a.click();
  }

  // Make canvas responsive with device pixel ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(300, Math.floor(rect.width * dpr));
      canvas.height = Math.max(48, Math.floor(90 * dpr)); // compact height
      canvas.style.height = "90px";
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const classTitle = "Recording";

  function goBackToMain() {
    if (!inClassLayer) return;
    const current = new URLSearchParams(searchParams.toString());
    current.delete("view");
    current.delete("lectureId");
    current.delete("tab");
    current.delete("record");
    const qs = current.toString();
    router.push(qs ? `/class/${classIdInPath}?${qs}` : `/class/${classIdInPath}`);
  }

  // ---- RENDER ----
  if (inClassLayer) {
    // full-bleed page panel
    return (
      <section className="flex h-full w-full flex-col bg-white">
        {/* Header: Back + title + timer + status */}
        <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-3">
          <button
            onClick={goBackToMain}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-black hover:bg-gray-100 cursor-pointer"
          >
            Back
          </button>
          <h1 className="text-sm font-semibold text-black truncate">{classTitle}</h1>

          <div className="ml-auto flex items-center gap-3">
            {/* TIMER (always visible) */}
            <span className="text-sm font-mono tabular-nums text-gray-900">
              {formatTime(elapsedMs)}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                state === "recording"
                  ? "bg-red-100 text-red-700"
                  : state === "paused"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {state === "recording" ? "Recording…" : state[0].toUpperCase() + state.slice(1)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="px-4 py-4 space-y-6">
            {/* Live waveform block — left-aligned, width capped */}
            <div className="w-full max-w-2xl">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-700">Live soundwave</div>
                {/* Secondary timer near controls area (also visible) */}
                <div className="text-xs font-mono tabular-nums text-gray-700">
                  {formatTime(elapsedMs)}
                </div>
              </div>
              <canvas
                ref={canvasRef}
                className="w-full block rounded-md bg-white border border-gray-200"
              />
            </div>

            {/* Controls (kept narrow to match wave) */}
            <div className="w-full max-w-2xl flex flex-wrap gap-2">
              {state === "idle" && (
                <button onClick={start} className="px-4 py-2 rounded-lg bg-black text-white">
                  Start
                </button>
              )}
              {state === "recording" && (
                <>
                  <button onClick={pauseRec} className="px-4 py-2 rounded-lg border">
                    Pause
                  </button>
                  <button onClick={stopRec} className="px-4 py-2 rounded-lg bg-black text-white">
                    Stop
                  </button>
                </>
              )}
              {state === "paused" && (
                <>
                  <button onClick={resumeRec} className="px-4 py-2 rounded-lg border">
                    Resume
                  </button>
                  <button onClick={stopRec} className="px-4 py-2 rounded-lg bg-black text-white">
                    Stop
                  </button>
                </>
              )}
              {state === "stopped" && (
                <>
                  <button onClick={resetRecording} className="px-4 py-2 rounded-lg border">
                    New recording
                  </button>
                </>
              )}
            </div>

            {/* ⬇️ Everything below goes full-bleed */}
            <div className="-mx-4 space-y-6">
              {/* File name (edge-to-edge section) */}
              <section className="px-4">
                <div className="w-full">
                  <label className="block text-sm text-gray-700 mb-1">File name</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-black bg-white"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Most browsers produce <code>.webm</code> (Opus). That’s fine—our uploader supports it.
                  </div>
                </div>
              </section>

              {/* Preview (edge-to-edge section) */}
              <section className="px-4">
                <div className="text-sm font-medium text-gray-800 mb-2">Preview</div>
                <div className="rounded-md border border-gray-200 p-3 bg-white">
                  {!blob && <div className="text-sm text-gray-500">No audio yet.</div>}
                  {blob && url && <audio controls src={url} className="w-full" />}
                </div>
              </section>

              {/* Upload row (edge-to-edge section) */}
              <section className="px-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Upload to class</label>
                    <select
                      className="w-full rounded-lg border px-3 py-2 text-black bg-white"
                      value={targetClassId}
                      onChange={(e) => setTargetClassId(e.target.value)}
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                      {classes.length === 0 && <option value="">No classes</option>}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      onClick={uploadToClass}
                      disabled={!blob || !targetClassId || isUploading}
                      className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
                    >
                      {isUploading ? "Uploading…" : "Upload"}
                    </button>
                    <button
                      onClick={downloadFile}
                      disabled={!blob}
                      className="px-4 py-2 rounded-lg border"
                    >
                      Download
                    </button>
                  </div>
                </div>
              </section>

              {/* Subtle status row (edge-to-edge or keep inside previous section if you prefer) */}
              <section className="px-4">
                <div className="text-xs text-gray-600 flex items-center gap-2">
                  <span>Status:</span>
                  <span className="font-medium">{state}</span>
                  {isUploading && (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block w-4 text-center font-mono">{spinner}</span>
                      Uploading...
                    </span>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Standalone view (kept as before; timer visible here too)
  return (
    <section className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-pink-200" />
      <div className="relative h-full w-full flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">Record audio</h1>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono tabular-nums text-gray-900">
                  {formatTime(elapsedMs)}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    state === "recording"
                      ? "bg-red-100 text-red-700"
                      : state === "paused"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {state === "recording" ? "Recording…" : state[0].toUpperCase() + state.slice(1)}
                </span>
              </div>
            </div>

            <div className="w-full max-w-2xl">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-700">Live soundwave</div>
                <div className="text-xs font-mono tabular-nums text-gray-700">{formatTime(elapsedMs)}</div>
              </div>
              <canvas ref={canvasRef} className="w-full block rounded-md bg-white" />
            </div>

            <div className="flex flex-wrap gap-2">
              {state === "idle" && (
                <button onClick={start} className="px-4 py-2 rounded-lg bg-black text-white">
                  Start
                </button>
              )}
              {state === "recording" && (
                <>
                  <button onClick={pauseRec} className="px-4 py-2 rounded-lg border">
                    Pause
                  </button>
                  <button onClick={stopRec} className="px-4 py-2 rounded-lg bg-black text-white">
                    Stop
                  </button>
                </>
              )}
              {state === "paused" && (
                <>
                  <button onClick={resumeRec} className="px-4 py-2 rounded-lg border">
                    Resume
                  </button>
                  <button onClick={stopRec} className="px-4 py-2 rounded-lg bg-black text-white">
                    Stop
                  </button>
                </>
              )}
              {state === "stopped" && (
                <>
                  <button onClick={resetRecording} className="px-4 py-2 rounded-lg border">
                    New recording
                  </button>
                </>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">File name</label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-black"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
              <div className="text-xs text-gray-500 mt-1">
                Most browsers produce <code>.webm</code> (Opus). That’s fine—our uploader supports it.
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-800 mb-2">Preview</div>
              <div className="rounded-lg border p-3 bg-gray-50">
                {!blob && <div className="text-sm text-gray-500">No audio yet.</div>}
                {blob && url && <audio controls src={url} className="w-full" />}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">Upload to class</label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-black bg-white"
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {classes.length === 0 && <option value="">No classes</option>}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={uploadToClass}
                  disabled={!blob || !targetClassId || isUploading}
                  className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
                >
                  {isUploading ? "Uploading…" : "Upload"}
                </button>
                <button
                  onClick={downloadFile}
                  disabled={!blob}
                  className="px-4 py-2 rounded-lg border"
                >
                  Download
                </button>
              </div>
            </div>

            {isUploading && (
              <div className="text-sm text-gray-700">
                <span className="inline-block w-4 text-center font-mono">{spinner}</span> Uploading...
              </div>
            )}

            <div className="text-xs text-gray-600">
              Status: <span className="font-medium">{state}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
