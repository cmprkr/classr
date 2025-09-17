// src/components/ProfileSettingsCard.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// Same list used in ClassSettings
import institutions from "data/institutions";
type Institution = (typeof institutions)[number];

type UserLite = {
  id: string | null;
  name: string | null;
  email: string | null;
  username: string | null;
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
  const [name, setName] = useState<string>(user.name ?? "");
  const [pfpFile, setPfpFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.image || null);
  const [busy, setBusy] = useState(false);

  // NEW: default university (primary domain)
  const [defaultUniversityDomain, setDefaultUniversityDomain] = useState<string>("");

  // Load current user defaults (domain) on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/me");
        if (!r.ok) return;
        const me = await r.json();
        const dom = (me?.defaultUniversityDomain || "").toLowerCase();
        if (dom) setDefaultUniversityDomain(dom);
      } catch {}
    })();
  }, []);

  const initial = useMemo(() => {
    const src = (name || user.username || user.email || " ").trim();
    return src ? src[0]!.toUpperCase() : "U";
  }, [name, user.username, user.email]);

  const schoolOptions = useMemo(() => {
    return institutions
      .map((s) => {
        const domain = (s.domains?.[0] || "").toLowerCase();
        if (!domain) return null;
        return { value: domain, label: `${s.name} — ${domain}` };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.label as string).localeCompare(b!.label)) as Array<{
      value: string;
      label: string;
    }>;
  }, []);

  async function saveProfile() {
    if (busy || !isSignedIn) return;
    setBusy(true);
    try {
      if (pfpFile) {
        const fd = new FormData();
        fd.append("file", pfpFile);
        const res = await fetch("/api/me/avatar", { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setPreviewUrl(data.imageUrl);
        setPfpFile(null);
      }

      // Name + defaultUniversityDomain are both optional; PATCH will accept either/both
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          defaultUniversityDomain: defaultUniversityDomain || null,
        }),
      });
      if (!response.ok) {
        console.warn("Profile PATCH failed:", await response.text());
      }
      router.refresh();
    } catch (e) {
      console.error("Save failed:", e);
      alert("Failed to save profile. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function cancelProfile() {
    setPfpFile(null);
    setPreviewUrl(user.image || null);
    setName(user.name ?? "");
    // Reset default uni by refetching
    setDefaultUniversityDomain("");
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        const dom = (me?.defaultUniversityDomain || "").toLowerCase();
        if (dom) setDefaultUniversityDomain(dom);
      })
      .catch(() => {});
  }

  function submitSignOut() {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/signout";
    document.body.appendChild(form);
    form.submit();
  }

  async function deleteProfile() {
    if (busy || !isSignedIn) return;
    const first = confirm("Delete your profile and all associated data? This cannot be undone.");
    if (!first) return;
    const second = confirm("Are you absolutely sure? This will permanently delete your account.");
    if (!second) return;

    setBusy(true);
    try {
      const res = await fetch("/api/me", { method: "DELETE" });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Delete request failed.");
      }
      submitSignOut();
    } catch (e: any) {
      console.error("Delete failed:", e);
      alert(`Failed to delete your profile.\n${e?.message ?? "Please try again or contact support."}`);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-6xl">
      <div className="rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 p-6 sm:p-8">
        <h1 className="text-3xl font-semibold text-black mb-6">Account</h1>
        <div className="grid gap-6 md:gap-8">
          <section className="rounded-2xl border bg-white p-5 sm:p-6">
            <header className="mb-3">
              <h2 className="text-lg font-semibold text-black">Profile</h2>
            </header>
            <div className="text-black">
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
                      disabled={busy || !isSignedIn}
                    />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-black">Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="mt-1 w-full rounded-lg border px-3 py-2 bg-white text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={busy || !isSignedIn}
                    />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-black">Username</label>
                    <input
                      value={user.username ?? "No username set"}
                      disabled
                      className="mt-1 w-full rounded-lg border px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-black">Email</label>
                    <input
                      value={user.email ?? "No email set"}
                      disabled
                      className="mt-1 w-full rounded-lg border px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  {/* NEW: Default university selection */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-black">
                      Default University (optional)
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 bg-white text-black"
                      value={defaultUniversityDomain}
                      onChange={(e) => setDefaultUniversityDomain(e.target.value)}
                      disabled={busy || !isSignedIn}
                    >
                      <option value="">— None —</option>
                      {schoolOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-600 mt-1">
                      This pre-fills the school when you enable sync on new classes. You can still change it per class.
                    </p>
                  </div>

                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={saveProfile}
                      disabled={busy || !isSignedIn}
                      className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60"
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelProfile}
                      disabled={busy || !isSignedIn}
                      className="rounded-lg border px-4 py-2 text-black disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {isSignedIn && (
            <section className="rounded-2xl border bg-white p-5 sm:p-6">
              <div className="text-black flex flex-wrap items-center gap-3">
                <form action="/api/auth/signout" method="post">
                  <button
                    type="submit"
                    className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-60"
                    disabled={busy}
                  >
                    Log Out
                  </button>
                </form>

                <button
                  type="button"
                  onClick={deleteProfile}
                  className="rounded-lg border border-red-700 text-red-700 hover:bg-red-50 px-4 py-2 disabled:opacity-60"
                  disabled={busy}
                >
                  Delete Profile
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-600">
                Deleting your profile permanently removes your account and associated data. This action cannot be undone.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
