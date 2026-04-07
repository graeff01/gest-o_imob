import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Auth — 2 perfis reais (hardcoded até o banco ser conectado).
 *
 * - Admin Master: visão completa do sistema, segurança e auditoria
 * - Dono: visão executiva, operação e resultados
 */

interface HardcodedUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "ADMIN_MASTER" | "DONO";
}

const USERS: HardcodedUser[] = [
  {
    id: "user-admin",
    name: "Admin Master",
    email: "admin@moinhos.com",
    password: "admin2026",
    role: "ADMIN_MASTER",
  },
  {
    id: "user-dono",
    name: "Proprietário",
    email: "dono@moinhos.com",
    password: "dono2026",
    role: "DONO",
  },
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").toLowerCase().trim();
        const password = String(credentials?.password || "");
        const user = USERS.find(
          (u) => u.email === email && u.password === password
        );
        if (!user) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).id = token.id;
        (session.user as unknown as Record<string, unknown>).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas
  },
});

export type Role = "ADMIN_MASTER" | "DONO";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};
