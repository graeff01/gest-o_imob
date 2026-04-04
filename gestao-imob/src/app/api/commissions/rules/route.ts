import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const rules = await prisma.commissionRule.findMany({
      orderBy: [
        { employee_type: 'asc' },
        { rule_type: 'asc' },
        { min_threshold: 'asc' },
      ],
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Error fetching commission rules:", error);
    return NextResponse.json({ error: "Failed to fetch commission rules" }, { status: 500 });
  }
}
