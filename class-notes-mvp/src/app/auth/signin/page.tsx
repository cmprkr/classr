"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/" });
    if (res?.ok) window.location.href = "/";
    else setErr("Invalid email or password");
  }

  return (
    <div className="w-full flex items-center justify-center">
      <form onSubmit={onSubmit} className="max-w-sm w-full p-6 space-y-4">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <input className="w-full border rounded px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
        <input className="w-full border rounded px-3 py-2" value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password"/>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button className="w-full bg-black text-white rounded py-2">Sign in</button>
        <div className="text-sm text-gray-600">
          No account? <Link href="/auth/signup" className="text-blue-600 underline">Create one</Link>
        </div>
      </form>
    </div>
  );
}
