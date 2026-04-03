import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.expenseCategory.findMany({
    orderBy: [{ parent_id: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ categories });
}
