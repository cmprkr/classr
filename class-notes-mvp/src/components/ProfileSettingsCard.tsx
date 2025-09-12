// src/components/ProfileSettingsCard.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserLite = {
  id: string | null;
  name: string;
  email: string;
  image?: string | null;
};

export default function ProfileSettingsCard({
  user,
  isSignedIn,
}: {
  user: UserLite;
  isSignedIn: boolean;
}) {
  const router = useRouter();

  // Local state
  const [pfpFile, setPfpFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.image || null);
  const [name, setName] = useState(user.name || "");
  const [busy, setBusy] = useState(false);

  // Derive avatar initial from CURRENT input value so it updates instantly
  const initial = useMemo(() => {
    const src = (name || user.email || " ").trim();
    return src ? src[0]!.toUpperCase() : "U";
  }, [name, user.email]);

  // Simple prefs (UI only here)
  const [uiLang, setUiLang] = useState("en");
  const [txLang, setTxLang] = useState("en-US");
  const [industry, setIndustry] = useState("");
  const [terms, setTerms] = useState("");

  async function saveProfile() {
    if (busy) return;
    setBusy(true);
    try {
      // 1) Avatar upload (optional)
      if (pfpFile) {
        const fd = new FormData();
        fd.append("file", pfpFile);
        const res = await fetch("/api/me/avatar", { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setPreviewUrl(data.imageUrl); // local preview immediately
        setPfpFile(null);             // clear file state
      }

      // 2) Always PATCH name (server may no-op if unchanged)
      const r2 = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r2.ok) {
        // non-fatal: show a console warning, still refresh the UI
        console.warn("Name PATCH failed:", await r2.text());
      }

      // 3) Pull fresh server data (layout + account are force-dynamic)
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Save failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function cancelProfile() {
    setPfpFile(null);
    setPreviewUrl(user.image || null);
    setName(user.name || "");
  }

  const Section = ({
    title,
    desc,
    children,
  }: {
    title: string;
    desc?: string;
    children: React.ReactNode;
  }) => (
    <section className="rounded-2xl border bg-white p-5 sm:p-6">
      <header className="mb-3">
        <h2 className="text-lg font-semibold text-black">{title}</h2>
        {desc ? <p className="text-sm text-black mt-1">{desc}</p> : null}
      </header>
      <div className="text-black">{children}</div>
    </section>
  );

  return (
    <div className="w-full max-w-6xl">
      <div className="rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 p-6 sm:p-8">
        <h1 className="text-3xl font-semibold text-black mb-6">Account</h1>

        <div className="grid gap-6 md:gap-8">
          {/* Profile picture + name */}
          <Section title="Profile Picture">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="relative">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Profile"
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border"
                  />
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gray-200 text-black grid place-items-center text-3xl font-semibold border">
                    {initial}
                  </div>
                )}
              </div>

              <div className="flex-1 w-full">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <label className="text-sm text-black">Upload new photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setPfpFile(f);
                      if (f) setPreviewUrl(URL.createObjectURL(f));
                    }}
                    className="block text-sm text-black"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-black">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="mt-1 w-full rounded-lg border px-3 py-2 bg-white text-black placeholder:text-gray-500"
                  />
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={busy}
                    className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={cancelProfile} className="rounded-lg border px-4 py-2">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* Preferences */}
          <Section title="Preference">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-black">Website Language</label>
                <select
                  value={uiLang}
                  onChange={(e) => setUiLang(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 bg-white text-black"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="zh">中文</option>
                </select>
                <div className="mt-3 flex gap-3">
                  <button type="button" className="rounded-lg bg-black px-4 py-2 text-white">Save</button>
                  <button type="button" onClick={() => setUiLang("en")} className="rounded-lg border px-4 py-2">
                    Cancel
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black">Transcription language</label>
                <select
                  value={txLang}
                  onChange={(e) => setTxLang(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 bg-white text-black"
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Español (ES)</option>
                  <option value="es-MX">Español (MX)</option>
                </select>
                <p className="text-xs text-black mt-2">
                  Default language for overview analysis, transcription and summary.
                </p>
                <div className="mt-3 flex gap-3">
                  <button type="button" className="rounded-lg bg-black px-4 py-2 text-white">Save</button>
                  <button type="button" onClick={() => setTxLang("en-US")} className="rounded-lg border px-4 py-2">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* Vocabulary */}
          <Section title="Vocabulary">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-black">Industry Preference</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 bg-white text-black"
                >
                  <option value="">Please select</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="finance">Finance</option>
                  <option value="legal">Legal</option>
                  <option value="software">Software</option>
                  <option value="education">Education</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black">Custom Terms</label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Add your terms (comma/newline separated)"
                  rows={5}
                  className="mt-1 w-full rounded-lg border px-3 py-2 bg-white text-black"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-3">
              <button type="button" className="rounded-lg bg-black px-4 py-2 text-white">Save</button>
              <button
                type="button"
                onClick={() => {
                  setIndustry("");
                  setTerms("");
                }}
                className="rounded-lg border px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </Section>

          {/* Legal & global logout */}
          <Section title="Legal & Privacy">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <a href="/legal/user-agreement" className="underline">User Agreement</a>
              <a href="/legal/privacy" className="underline">Privacy Policy</a>
              <a href="/legal/cookies" className="underline">Cookie Policy</a>
              <a href="/legal/cookie-settings" className="underline">Cookie Settings</a>
            </div>

            <div className="mt-4">
              {isSignedIn ? (
                <form action="/api/auth/signout" method="post">
                  <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-white">Log Out</button>
                </form>
              ) : (
                <div className="text-sm text-black">
                  You’re not signed in. <a href="/auth/signin" className="underline">Sign in</a>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
