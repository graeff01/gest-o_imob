import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// ─── Usuários carregados de variáveis de ambiente ─────────────────────────────
// Senhas armazenadas como hash bcrypt (nunca em texto puro).
// Para trocar a senha: gere um novo hash com `node -e "require('bcryptjs').hash('nova_senha', 12).then(console.log)"`
// e atualize a variável de ambiente correspondente.

interface EnvUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "ADMIN_MASTER" | "DONO";
}

function loadUsers(): EnvUser[] {
  const users: EnvUser[] = [];

  const adminEmail = process.env.AUTH_ADMIN_EMAIL;
  const adminHash  = process.env.AUTH_ADMIN_HASH;
  const adminName  = process.env.AUTH_ADMIN_NAME ?? "Admin Master";

  const donoEmail  = process.env.AUTH_DONO_EMAIL;
  const donoHash   = process.env.AUTH_DONO_HASH;
  const donoName   = process.env.AUTH_DONO_NAME ?? "Proprietário";

  if (adminEmail && adminHash) {
    users.push({ id: "user-admin", name: adminName, email: adminEmail.toLowerCase(), passwordHash: adminHash, role: "ADMIN_MASTER" });
  }
  if (donoEmail && donoHash) {
    users.push({ id: "user-dono", name: donoName, email: donoEmail.toLowerCase(), passwordHash: donoHash, role: "DONO" });
  }

  if (users.length === 0) {
    console.error("[auth] Nenhum usuário configurado. Defina AUTH_ADMIN_EMAIL, AUTH_ADMIN_HASH, AUTH_DONO_EMAIL e AUTH_DONO_HASH nas variáveis de ambiente.");
  }

  return users;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email    = String(credentials?.email    ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");

        if (!email || !password) return null;

        const users = loadUsers();
        const user  = users.find(u => u.email === email);
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id:   user.id,
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
        token.id   = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).id   = token.id;
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
