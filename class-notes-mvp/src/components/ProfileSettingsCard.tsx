// src/components/ProfileSettingsCard.tsx
"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserLite = {
  id: string | null;
  name: string | null;
  email: string | null;
  username: string | null; // Reflects User model where username is optional
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

  // Debug user data
  console.log("User data in ProfileSettingsCard:", {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
  });

  // Derive avatar initial from current input value
  const initial = useMemo(() => {
    const src = (name || user.username || user.email || " ").trim();
    return src ? src[0]!.toUpperCase() : "U";
  }, [name, user.username, user.email]);

  async function saveProfile() {
    if (busy || !isSignedIn) return;
    setBusy(true);
    try {
      // 1) Avatar upload (if a file is selected)
      if (pfpFile) {
        const fd = new FormData();
        fd.append("file", pfpFile);
        const res = await fetch("/api/me/avatar", { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setPreviewUrl(data.imageUrl);
        setPfpFile(null);
      }
      // 2) Update name
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        console.warn("Name PATCH failed:", await response.text());
      }
      router.refresh(); // Refresh to pull fresh server data
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
  }

  return (
    <div className="w-full max-w-6xl">
      <div className="rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 p-6 sm:p-8">
        <h1 className="text-3xl font-semibold text-black mb-6">Account</h1>
        <div className="grid gap-6 md:gap-8">
          {/* Profile Picture + Name + Username + Email */}
          <section className="rounded-2xl border bg-white p-5 sm:p-6">
            <header className="mb-3">
              <h2 className="text-lg font-semibold text-black">Profile Picture</h2>
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
                      onChange={(e) => {
                        console.log("Name input changed:", e.target.value); // Debug log
                        setName(e.target.value);
                      }}
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
          {/* Log Out */}
          {isSignedIn && (
            <section className="rounded-2xl border bg-white p-5 sm:p-6">
              <div className="text-black">
                <form action="/api/auth/signout" method="post">
                  <button
                    type="submit"
                    className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-60"
                    disabled={busy}
                  >
                    Log Out
                  </button>
                </form>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}