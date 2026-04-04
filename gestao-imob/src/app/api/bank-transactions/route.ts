import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bankAccountId = searchParams.get("bank_account_id");
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const reconciled = searchParams.get("reconciled");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};

  if (bankAccountId) where.bank_account_id = bankAccountId;

  if (reconciled === "true") where.is_reconciled = true;
  if (reconciled === "false") where.is_reconciled = false;

  if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0);
    where.date = { gte: startDate, lte: endDate };
  } else if (year) {
    where.date = {
      gte: new Date(Number(year), 0, 1),
      lte: new Date(Number(year), 11, 31),
    };
  }

  if (search) {
    where.description = { contains: search, mode: "insensitive" };
  }

  const transactions = await prisma.bankTransaction.findMany({
    where,
    include: { bank_account: true, category: true },
    orderBy: { date: "desc" },
    take: 500,
  });

  // Totais
  const credits = transactions.filter((t) => t.is_credit);
  const debits = transactions.filter((t) => !t.is_credit);

  return NextResponse.json({
    transactions,
    summary: {
      total: transactions.length,
      totalCredits: credits.reduce((s, t) => s + Number(t.amount), 0),
      totalDebits: debits.reduce((s, t) => s + Number(t.amount), 0),
      reconciled: transactions.filter((t) => t.is_reconciled).length,
      pending: transactions.filter((t) => !t.is_reconciled).length,
    },
  });
}
