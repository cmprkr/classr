// types/next-auth.d.ts
import NextAuth, { DefaultSession } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string | null;
      username: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    userId?: string | null;
    username?: string | null;
    picture?: string | null;
  }
}
