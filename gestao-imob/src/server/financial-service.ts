import { prisma } from "@/lib/prisma";
import type { CreateExpenseInput, CreateRevenueInput } from "@/lib/validations/financeiro";
import type { AuthContext } from "@/server/authz";
import { auditCrud } from "@/server/crud-audit";
import { canUseMockFallback } from "@/server/mock-policy";

interface ListFinancialFilters {
  page: number;
  limit: number;
  month?: string | null;
  year?: string | null;
}

interface ListRevenueFilters extends ListFinancialFilters {
  category?: string | null;
}

interface ListExpenseFilters extends ListFinancialFilters {
  category_id?: string | null;
  status?: string | null;
}

export async function listRevenues(filters: ListRevenueFilters) {
  const { page, limit, month, year, category } = filters;
  const skip = (page - 1) * limit;
  const now = new Date();
  const refMonth = month ? parseInt(month, 10) : now.getMonth() + 1;
  const refYear = year ? parseInt(year, 10) : now.getFullYear();

  const where = {
    reference_month: refMonth,
    reference_year: refYear,
    ...(category
      ? {
          category: category as
            | "INTERMEDIACAO"
            | "AGENCIAMENTO"
            | "CAMPANHA_SUCESSO"
            | "CAMPANHA_CAPTACAO"
            | "NFSE_ALUGUEL"
            | "ROYALTY"
            | "OUTRO",
        }
      : {}),
  };

  try {
    const [revenues, total, totalAmount] = await Promise.all([
      prisma.revenue.findMany({
        where,
        include: { contract: { select: { contract_number: true } } },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.revenue.count({ where }),
      prisma.revenue.aggregate({ where, _sum: { amount: true } }),
    ]);

    if (revenues.length === 0 && total === 0 && canUseMockFallback()) {
      return { revenues: [], total: 0, totalAmount: 0, page, limit };
    }

    return {
      revenues,
      total,
      totalAmount: Number(totalAmount._sum.amount || 0),
      page,
      limit,
    };
  } catch (error) {
    if (canUseMockFallback()) {
      return { revenues: [], total: 0, totalAmount: 0, page, limit };
    }
    throw error;
  }
}

export async function createRevenue(input: CreateRevenueInput, ctx: AuthContext) {
  const date = new Date(input.date);
  const revenue = await prisma.revenue.create({
    data: {
      contract_id: input.contract_id || null,
      category: input.category,
      description: input.description,
      amount: parseFloat(input.amount),
      date,
      department: input.department,
      reference_month: date.getMonth() + 1,
      reference_year: date.getFullYear(),
      notes: input.notes || null,
      created_by: ctx.dbUserId,
    },
  });

  await auditCrud({
    ctx,
    entityType: "revenue",
    entityId: revenue.id,
    entityLabel: revenue.description,
    action: "created",
    summary: `Receita ${revenue.description} cadastrada.`,
    metadata: { category: revenue.category, amount: Number(revenue.amount) },
  });

  return revenue;
}

export async function listExpenses(filters: ListExpenseFilters) {
  const { page, limit, month, year, category_id, status } = filters;
  const skip = (page - 1) * limit;
  const now = new Date();
  const refMonth = month ? parseInt(month, 10) : now.getMonth() + 1;
  const refYear = year ? parseInt(year, 10) : now.getFullYear();

  const where = {
    reference_month: refMonth,
    reference_year: refYear,
    ...(category_id ? { category_id } : {}),
    ...(status ? { status: status as "PENDENTE" | "PAGO" | "VENCIDO" | "CANCELADO" } : {}),
  };

  try {
    const [expenses, total, totalAmount] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: { category: { select: { name: true, code: true } } },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    if (expenses.length === 0 && total === 0 && canUseMockFallback()) {
      return { expenses: [], total: 0, totalAmount: 0, page, limit };
    }

    return {
      expenses,
      total,
      totalAmount: Number(totalAmount._sum.amount || 0),
      page,
      limit,
    };
  } catch (error) {
    if (canUseMockFallback()) {
      return { expenses: [], total: 0, totalAmount: 0, page, limit };
    }
    throw error;
  }
}

export async function createExpense(input: CreateExpenseInput, ctx: AuthContext) {
  const date = new Date(input.date);
  const expense = await prisma.expense.create({
    data: {
      category_id: input.category_id,
      description: input.description,
      amount: parseFloat(input.amount),
      date,
      due_date: input.due_date ? new Date(input.due_date) : null,
      department: input.department,
      payment_method: input.payment_method || null,
      status: input.status || "PENDENTE",
      reference_month: date.getMonth() + 1,
      reference_year: date.getFullYear(),
      supplier: input.supplier || null,
      notes: input.notes || null,
      created_by: ctx.dbUserId,
    },
    include: { category: { select: { name: true } } },
  });

  await auditCrud({
    ctx,
    entityType: "expense",
    entityId: expense.id,
    entityLabel: expense.description,
    action: "created",
    summary: `Despesa ${expense.description} cadastrada.`,
    metadata: { status: expense.status, amount: Number(expense.amount) },
  });

  return expense;
}
