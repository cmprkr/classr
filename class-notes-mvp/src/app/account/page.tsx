// app/account/page.tsx
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import Link from "next/link";
import AllClassesPanel from "@/components/AllClassesPanel";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);

  return (
    <>
      {/* Left: keep All Classes visible */}
      <AllClassesPanel />

      {/* Right: gradient background + centered white card */}
      <section className="relative flex-1 overflow-hidden">
        {/* Gradient backdrop (Stripe-ish) */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-pink-200" />

        {/* Content layer */}
        <div className="relative h-full w-full flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5 p-6 sm:p-8">
              <h1 className="text-2xl font-semibold mb-4 text-gray-900">Account</h1>

              {!session ? (
                <div className="space-y-5">
                  <p className="text-gray-700">You’re not signed in.</p>
                  <div className="flex gap-3">
                    <Link
                      href="/auth/signin"
                      className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-gray-800"
                    >
                      Create account
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-sm text-gray-600">Signed in as</div>
                    <div className="text-lg text-gray-900">
                      {session.user?.name || "User"}
                    </div>
                    <div className="text-gray-700">{session.user?.email}</div>
                  </div>

                  {/* Sign out posts to your NextAuth signout route */}
                  <form action="/api/auth/signout" method="post">
                    <button className="rounded-lg bg-red-600 px-4 py-2 text-white">
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
