import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import Link from "next/link";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);

  return (
    <section className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold mb-4">Account</h1>
        {!session ? (
          <div className="space-y-4">
            <p className="text-gray-700">You’re not signed in.</p>
            <Link href="/auth/signin" className="inline-block bg-black text-white px-4 py-2 rounded">Sign in</Link>
            <Link href="/auth/signup" className="inline-block ml-2 border px-4 py-2 rounded">Create account</Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded border bg-white p-4">
              <div className="text-sm text-gray-600">Signed in as</div>
              <div className="text-lg">{session.user?.name || "User"}</div>
              <div className="text-gray-700">{session.user?.email}</div>
            </div>
            <form action="/api/auth/signout" method="post">
              <button className="bg-red-600 text-white px-4 py-2 rounded">Sign out</button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
