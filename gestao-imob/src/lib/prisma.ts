import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Se não tem DATABASE_URL, retorna um client que vai falhar nas queries
  // mas não vai crashar o build. Os API routes já tratam o erro com try/catch.
  if (!process.env.DATABASE_URL) {
    return new Proxy({} as PrismaClient, {
      get(_, prop) {
        // Retorna um objeto que simula os models do Prisma
        // Qualquer chamada .findMany(), .create() etc. vai lançar erro
        // que é capturado pelo try/catch dos API routes → fallback mock
        if (typeof prop === "string" && prop !== "then") {
          return new Proxy(
            {},
            {
              get() {
                return async () => {
                  throw new Error("DATABASE_URL not configured");
                };
              },
            }
          );
        }
        return undefined;
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require("@prisma/adapter-pg");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
