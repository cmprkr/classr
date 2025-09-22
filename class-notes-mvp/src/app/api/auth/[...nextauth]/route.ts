// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase();
        const password = credentials?.password || "";
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // ✅ include plan info so callbacks can hydrate JWT/session
        return {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          username: user.username ?? null,
          planTier: (user as any).planTier ?? "FREE",
          planStatus: (user as any).planStatus ?? null,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // persist id + extras into the token on first sign-in
        (token as any).userId   = (user as any).id ?? (token as any).userId ?? token.sub ?? null;
        (token as any).username = (user as any).username ?? (token as any).username ?? null;
        (token as any).picture  = (user as any).image ?? (token as any).picture ?? null;
        token.name  = user.name  ?? token.name  ?? null;
        token.email = user.email ?? token.email ?? null;

        // ✅ plan info (used by the paywall)
        (token as any).planTier   = (user as any).planTier   ?? (token as any).planTier   ?? "FREE";
        (token as any).planStatus = (user as any).planStatus ?? (token as any).planStatus ?? null;
      }
      return token;
    },

    async session({ session, token, user }) {
      const id = (token as any).userId ?? token.sub ?? (user as any)?.id ?? null;

      if (session.user) {
        (session.user as any).id        = id;
        (session.user as any).username  = (token as any).username ?? (session.user as any).username ?? null;
        session.user.name               = token.name  ?? session.user.name  ?? null;
        session.user.email              = token.email ?? session.user.email ?? null;
        session.user.image              = (token as any).picture ?? session.user.image ?? null;

        // ✅ plan info onto the session for UI / gating
        (session.user as any).planTier   = (token as any).planTier   ?? "FREE";
        (session.user as any).planStatus = (token as any).planStatus ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
