// app/auth/signin/page.tsx
import AllClassesPanel from "@/components/AllClassesPanel";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Link from "next/link";
import SignInCard from "@/components/SignInCard";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);

  return (
    <>
      {/* Left: All Classes list */}
      <AllClassesPanel />

      {/* Right: Gradient + centered white card */}
      <section className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-pink-200" />
        <div className="relative h-full w-full flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5 p-6 sm:p-8">
              <h1 className="text-2xl font-semibold mb-4 text-gray-900">Sign in</h1>

              {session ? (
                <div className="space-y-6">
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-sm text-gray-600">Signed in as</div>
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
                  {/* Credentials sign-in handled client-side (no manual CSRF needed) */}
                  <SignInCard callbackUrl="/account" />

                  <div className="text-sm text-gray-700">
                    Don’t have an account?{" "}
                    <Link href="/auth/signup" className="underline">
                      Create one
                    </Link>
                  </div>

                  {/* Optional OAuth providers:
                  <div className="flex items-center gap-3">
                    <a href="/api/auth/signin/google" className="flex-1 rounded-lg border px-4 py-2 text-center">
                      Continue with Google
                    </a>
                  </div> */}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
