import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany();
  console.log("Registered Users:", users.map(u => ({ email: u.email, is_active: u.is_active })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
