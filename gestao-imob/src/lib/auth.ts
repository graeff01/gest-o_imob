import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { assertRuntimeSafety } from "@/server/env";

assertRuntimeSafety();

// Usuarios carregados de variaveis de ambiente.
// Senhas ficam sempre como hash bcrypt, nunca em texto puro.
interface EnvUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "ADMIN_MASTER" | "DONO";
}

function normalizeBcryptHash(hash: string) {
  return hash.replace(/\\\$/g, "$");
}

function appendEnvUser(users: EnvUser[], user: EnvUser | null) {
  if (user) users.push(user);
}

function loadUsers(): EnvUser[] {
  const users: EnvUser[] = [];

  const adminEmail = process.env.AUTH_ADMIN_EMAIL;
  const adminHash = process.env.AUTH_ADMIN_HASH;
  const adminName = process.env.AUTH_ADMIN_NAME ?? "Admin Master";

  appendEnvUser(
    users,
    adminEmail && adminHash
      ? {
          id: "user-admin",
          name: adminName,
          email: adminEmail.toLowerCase(),
          passwordHash: normalizeBcryptHash(adminHash),
          role: "ADMIN_MASTER",
        }
      : null
  );

  // Compatibilidade com a variavel antiga de um dono.
  const legacyOwnerEmail = process.env.AUTH_DONO_EMAIL;
  const legacyOwnerHash = process.env.AUTH_DONO_HASH;
  const legacyOwnerName = process.env.AUTH_DONO_NAME ?? "Proprietario";

  appendEnvUser(
    users,
    legacyOwnerEmail && legacyOwnerHash
      ? {
          id: "user-dono",
          name: legacyOwnerName,
          email: legacyOwnerEmail.toLowerCase(),
          passwordHash: normalizeBcryptHash(legacyOwnerHash),
          role: "DONO",
        }
      : null
  );

  for (const slot of ["1", "2"]) {
    const ownerEmail = process.env[`AUTH_OWNER_${slot}_EMAIL`];
    const ownerHash = process.env[`AUTH_OWNER_${slot}_HASH`];
    const ownerName = process.env[`AUTH_OWNER_${slot}_NAME`] ?? `Dono ${slot}`;

    appendEnvUser(
      users,
      ownerEmail && ownerHash
        ? {
            id: `user-owner-${slot}`,
            name: ownerName,
            email: ownerEmail.toLowerCase(),
            passwordHash: normalizeBcryptHash(ownerHash),
            role: "DONO",
          }
        : null
    );
  }

  const duplicatedEmail = users.find(
    (user, index) => users.findIndex((candidate) => candidate.email === user.email) !== index
  );
  if (duplicatedEmail) {
    console.error(`[auth] Email duplicado nas variaveis de ambiente: ${duplicatedEmail.email}`);
    return [];
  }

  if (users.length === 0) {
    console.error(
      "[auth] Nenhum usuario configurado. Defina AUTH_ADMIN_EMAIL/AUTH_ADMIN_HASH e AUTH_OWNER_1_EMAIL/AUTH_OWNER_1_HASH."
    );
  }

  return users;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");

        if (!email || !password) return null;

        const users = loadUsers();
        const user = users.find((candidate) => candidate.email === email);
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

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
    maxAge: 8 * 60 * 60,
  },
});

export type Role = "ADMIN_MASTER" | "DONO";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};
