import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AppRole = "ADMIN_MASTER" | "DONO" | "ADMIN" | "MANAGER";

export interface AuthContext {
  userId: string;
  email: string;
  role: AppRole;
  dbUserId: string;
}

const elevatedRoles = new Set<AppRole>(["ADMIN_MASTER", "DONO", "ADMIN"]);
const technicalRoles = new Set<AppRole>(["ADMIN_MASTER"]);

export class AuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

export async function requireAuth(): Promise<AuthContext> {
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string | null; role?: AppRole }
    | undefined;

  if (!user?.id || !user.email || !user.role) {
    throw new AuthError("Nao autenticado.", 401);
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email.toLowerCase() },
    select: { id: true, is_active: true },
  });

  if (!dbUser?.is_active) {
    throw new AuthError("Usuario sem cadastro ativo no banco.", 403);
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    dbUserId: dbUser.id,
  };
}

export async function requireElevatedRole(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!elevatedRoles.has(ctx.role)) {
    throw new AuthError("Sem permissao para executar esta acao.", 403);
  }
  return ctx;
}

export async function requireTechnicalRole(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!technicalRoles.has(ctx.role)) {
    throw new AuthError("Acesso restrito ao administrador tecnico.", 403);
  }
  return ctx;
}
