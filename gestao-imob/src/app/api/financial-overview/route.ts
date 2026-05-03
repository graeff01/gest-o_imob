import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/server/api-response";
import { requireAuth } from "@/server/authz";

type MoneyBucket = { amount: unknown };
type CountBucket = { status: string; _count: { _all: number }; _sum?: { amount?: unknown; rent_value?: unknown; intermediation_value?: unknown } };

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return `${month}/${year}`;
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1);
}

function endOfMonth(year: number, month: number) {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

function lastMonthKeys(count: number) {
  const keys: string[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

function countByStatus(rows: CountBucket[]) {
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}

export async function GET(request: Request) {
  try {
    await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);
  const from = startOfMonth(year, month);
  const to = endOfMonth(year, month);
  const flowKeys = lastMonthKeys(6);
  const flowFrom = startOfMonth(Number(flowKeys[0].slice(0, 4)), Number(flowKeys[0].slice(5, 7)));

  try {
    const [
      revenues,
      expenses,
      invoices,
      bankTransactions,
      bankAccounts,
      contractsByStatus,
      expiringContracts,
      propertiesByStatus,
      clientsCount,
      ownersCount,
      commissionCalculations,
      commissionRulesCount,
      flowRevenues,
      flowExpenses,
      expenseCategories,
      recentRevenues,
      recentExpenses,
      recentInvoices,
      recentBankTransactions,
    ] = await Promise.all([
      prisma.revenue.aggregate({
        where: { date: { gte: from, lte: to } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: from, lte: to }, status: { not: "CANCELADO" } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.invoice.groupBy({
        by: ["status"],
        where: { reference_year: year, ...(month ? { reference_month: month } : {}) },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.bankTransaction.aggregate({
        where: { date: { gte: from, lte: to } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.bankAccount.findMany({
        where: { is_active: true },
        select: { id: true, bank_name: true, account_number: true, current_balance: true },
        orderBy: { bank_name: "asc" },
      }),
      prisma.contract.groupBy({
        by: ["status"],
        _count: { _all: true },
        _sum: { rent_value: true, intermediation_value: true },
      }),
      prisma.contract.count({
        where: {
          status: "ATIVO",
          end_date: { gte: now, lte: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30) },
        },
      }),
      prisma.property.groupBy({
        by: ["status"],
        where: { is_active: true },
        _count: { _all: true },
      }),
      prisma.client.count({ where: { is_active: true } }),
      prisma.propertyOwner.count({ where: { is_active: true } }),
      prisma.commissionCalculation.aggregate({
        where: { reference_year: year, reference_month: month },
        _sum: { total_commission: true },
        _count: { _all: true },
      }),
      prisma.commissionRule.count(),
      prisma.revenue.findMany({
        where: { date: { gte: flowFrom, lte: to } },
        select: { amount: true, date: true, category: true },
      }),
      prisma.expense.findMany({
        where: { date: { gte: flowFrom, lte: to }, status: { not: "CANCELADO" } },
        select: { amount: true, date: true, category: { select: { name: true } } },
      }),
      prisma.expenseCategory.findMany({
        where: { is_active: true },
        select: {
          id: true,
          name: true,
          expenses: {
            where: { date: { gte: from, lte: to }, status: { not: "CANCELADO" } },
            select: { amount: true },
          },
        },
      }),
      prisma.revenue.findMany({
        orderBy: { date: "desc" },
        take: 5,
        select: { id: true, description: true, amount: true, date: true, category: true },
      }),
      prisma.expense.findMany({
        orderBy: { date: "desc" },
        take: 5,
        select: { id: true, description: true, amount: true, date: true, status: true, category: { select: { name: true } } },
      }),
      prisma.invoice.findMany({
        orderBy: { updated_at: "desc" },
        take: 5,
        select: { id: true, client_name: true, amount: true, status: true, updated_at: true, nfse_number: true, year_sequence: true },
      }),
      prisma.bankTransaction.findMany({
        orderBy: [{ date: "desc" }, { created_at: "desc" }],
        take: 5,
        select: { id: true, description: true, amount: true, date: true, is_credit: true, is_reconciled: true },
      }),
    ]);

    const invoiceRows = invoices as CountBucket[];
    const invoiceStatus = countByStatus(invoiceRows);
    const invoiceTotalAmount = invoiceRows.reduce((sum, row) => sum + toNumber(row._sum?.amount), 0);
    const invoiceIssuedAmount = invoiceRows
      .filter((row) => ["EMITIDA", "ENVIADA", "PAGA"].includes(row.status))
      .reduce((sum, row) => sum + toNumber(row._sum?.amount), 0);

    const bankMonthRows = await prisma.bankTransaction.findMany({
      where: { date: { gte: from, lte: to } },
      select: { amount: true, is_credit: true, is_reconciled: true, needs_review: true },
    });

    const flow = flowKeys.map((key) => {
      const revenueTotal = flowRevenues
        .filter((row) => monthKey(row.date) === key)
        .reduce((sum, row: MoneyBucket) => sum + toNumber(row.amount), 0);
      const expenseTotal = flowExpenses
        .filter((row) => monthKey(row.date) === key)
        .reduce((sum, row: MoneyBucket) => sum + toNumber(row.amount), 0);

      return {
        monthKey: key,
        label: monthLabel(key),
        revenues: revenueTotal,
        expenses: expenseTotal,
        result: revenueTotal - expenseTotal,
      };
    });

    const topExpenseCategories = expenseCategories
      .map((category) => ({
        id: category.id,
        name: category.name,
        total: category.expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0),
        count: category.expenses.length,
      }))
      .filter((category) => category.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const revenueCategories = Object.values(
      flowRevenues
        .filter((row) => row.date >= from && row.date <= to)
        .reduce<Record<string, { category: string; total: number; count: number }>>((acc, row) => {
          const category = row.category;
          acc[category] = acc[category] ?? { category, total: 0, count: 0 };
          acc[category].total += toNumber(row.amount);
          acc[category].count += 1;
          return acc;
        }, {})
    ).sort((a, b) => b.total - a.total);

    return NextResponse.json({
      reference: { month, year, label: monthLabel(`${year}-${String(month).padStart(2, "0")}`) },
      financial: {
        revenues: toNumber(revenues._sum.amount),
        revenueCount: revenues._count._all,
        expenses: toNumber(expenses._sum.amount),
        expenseCount: expenses._count._all,
        result: toNumber(revenues._sum.amount) - toNumber(expenses._sum.amount),
      },
      invoices: {
        total: invoiceRows.reduce((sum, row) => sum + row._count._all, 0),
        totalAmount: invoiceTotalAmount,
        issuedAmount: invoiceIssuedAmount,
        pendingAmount: invoiceRows.filter((row) => row.status === "PENDENTE").reduce((sum, row) => sum + toNumber(row._sum?.amount), 0),
        byStatus: invoiceStatus,
      },
      bank: {
        accounts: bankAccounts.map((account) => ({
          ...account,
          current_balance: toNumber(account.current_balance),
        })),
        transactionCount: bankTransactions._count._all,
        totalMoved: toNumber(bankTransactions._sum.amount),
        credits: bankMonthRows.filter((row) => row.is_credit).reduce((sum, row) => sum + toNumber(row.amount), 0),
        debits: bankMonthRows.filter((row) => !row.is_credit).reduce((sum, row) => sum + toNumber(row.amount), 0),
        reconciled: bankMonthRows.filter((row) => row.is_reconciled).length,
        unreconciled: bankMonthRows.filter((row) => !row.is_reconciled).length,
        pendingReview: bankMonthRows.filter((row) => row.needs_review).length,
      },
      contracts: {
        total: contractsByStatus.reduce((sum, row) => sum + row._count._all, 0),
        byStatus: countByStatus(contractsByStatus as CountBucket[]),
        expiring30Days: expiringContracts,
        monthlyRent: contractsByStatus.reduce((sum, row) => sum + toNumber(row._sum.rent_value), 0),
        intermediation: contractsByStatus.reduce((sum, row) => sum + toNumber(row._sum.intermediation_value), 0),
      },
      properties: {
        total: propertiesByStatus.reduce((sum, row) => sum + row._count._all, 0),
        byStatus: countByStatus(propertiesByStatus as CountBucket[]),
      },
      people: { clients: clientsCount, owners: ownersCount },
      commissions: {
        total: toNumber(commissionCalculations._sum.total_commission),
        count: commissionCalculations._count._all,
        rules: commissionRulesCount,
      },
      flow,
      topExpenseCategories,
      revenueCategories,
      recent: {
        revenues: recentRevenues.map((row) => ({ ...row, amount: toNumber(row.amount) })),
        expenses: recentExpenses.map((row) => ({ ...row, amount: toNumber(row.amount) })),
        invoices: recentInvoices.map((row) => ({ ...row, amount: toNumber(row.amount) })),
        bankTransactions: recentBankTransactions.map((row) => ({ ...row, amount: toNumber(row.amount) })),
      },
    });
  } catch (error) {
    console.error("[financial-overview] error:", error);
    return NextResponse.json({ error: "Erro ao consolidar dados financeiros reais." }, { status: 500 });
  }
}
