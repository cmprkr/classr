// app/auth/signup/page.tsx
import AllClassesPanel from "@/components/AllClassesPanel";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Link from "next/link";

export default async function SignUpPage() {
  const session = await getServerSession(authOptions);

  return (
    <>
      {/* Left: All Classes list (unchanged) */}
      <AllClassesPanel />

      {/* Right: Gradient + centered white card */}
      <section className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-pink-200" />
        <div className="relative h-full w-full flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5 p-6 sm:p-8">
              <h1 className="text-2xl font-semibold mb-4 text-gray-900">Create account</h1>

              {session ? (
                <div className="space-y-6">
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-sm text-gray-600">You’re already signed in as</div>
                    <div className="text-lg text-gray-900">{session.user?.name || "User"}</div>
                    <div className="text-gray-700">{session.user?.email}</div>
                  </div>
                  <form action="/api/auth/signout" method="post">
                    <button className="rounded-lg bg-red-600 px-4 py-2 text-white">
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Signup form — posts as application/x-www-form-urlencoded */}
                  <form action="/api/auth/signup" method="post" className="space-y-4">
                    <input
                      type="text"
                      name="name"
                      placeholder="Full name (optional)"
                      className="w-full rounded-lg border px-3 py-2 bg-white text-black placeholder-gray-500"
                    />
                    <input
                      type="text"
                      name="username"
                      required
                      pattern="^[a-zA-Z0-9_.-]{3,30}$"
                      title="3–30 chars: letters, numbers, underscore, dot, dash"
                      placeholder="Username"
                      className="w-full rounded-lg border px-3 py-2 bg-white text-black placeholder-gray-500"
                    />
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="Email"
                      className="w-full rounded-lg border px-3 py-2 bg-white text-black placeholder-gray-500"
                    />
                    <input
                      type="password"
                      name="password"
                      required
                      placeholder="Password"
                      className="w-full rounded-lg border px-3 py-2 bg-white text-black placeholder-gray-500"
                    />
                    <button type="submit" className="w-full rounded-lg bg-black px-4 py-2 text-white">
                      Create account
                    </button>
                  </form>

                  <div className="text-sm text-gray-700">
                    Already have an account?{" "}
                    <Link href="/auth/signin" className="underline">
                      Sign in
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
