"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInCard({ callbackUrl = "/account" }: { callbackUrl?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);

    // next-auth handles CSRF internally here
    const res = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: true, // navigate on success
    });

    // If redirect is blocked/disabled, next-auth returns an object we could inspect.
    // We keep UI responsive either way:
    if (res && (res as any).error) setErr((res as any).error);
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="email"
        name="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 bg-white text-black placeholder-gray-500"
      />
      <input
        type="password"
        name="password"
        required
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 bg-white text-black placeholder-gray-500"
      />

      {err && <div className="text-sm text-red-600">{err}</div>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}
