import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "../../drizzle/schema";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.email, credentials.email as string),
              eq(users.isActive, true)
            )
          )
          .limit(1);

        if (!user) return null;

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, copy fields from the authorized user.
      if (user) {
        token.role = (user as { role: string }).role;
        token.tenantId = (user as { tenantId: string }).tenantId;
        return token;
      }

      // On every subsequent request, re-validate the user against the DB.
      // If the user no longer exists (e.g. after a setup.sh reset that wiped
      // and re-seeded the DB), return null so the session is invalidated and
      // the user is redirected to the login page to obtain a fresh JWT.
      // This also keeps role/tenantId in the token in sync with the DB.
      if (!token.sub) return null;

      try {
        const [dbUser] = await db
          .select({
            id: users.id,
            role: users.role,
            tenantId: users.tenantId,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.id, token.sub))
          .limit(1);

        if (!dbUser || !dbUser.isActive) {
          return null;
        }

        token.role = dbUser.role;
        token.tenantId = dbUser.tenantId;
        return token;
      } catch (err) {
        // If the DB lookup fails (e.g. DB unavailable), keep the existing
        // token rather than logging the user out spuriously.
        console.error("[auth] jwt validation failed:", err);
        return token;
      }
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.tenantId = token.tenantId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
