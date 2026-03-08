import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { ensureDefaultAdminUser } from "@/lib/admin-user";
import { verifyPassword } from "@/lib/password";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "username", type: "text" },
        password: { label: "password", type: "password" },
      },
      authorize: async (credentials) => {
        await ensureDefaultAdminUser();

        const username = String(credentials?.username ?? "").trim();
        const password = String(credentials?.password ?? "");
        if (!username || !password) {
          return null;
        }

        const user = await db
          .select()
          .from(adminUsers)
          .where(eq(adminUsers.username, username))
          .limit(1);

        const admin = user[0];
        if (!admin || !verifyPassword(password, admin.passwordSalt, admin.passwordHash)) {
          return null;
        }

        return {
          id: admin.id,
          name: admin.displayName,
          email: `${admin.username}@local.portal`,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});
