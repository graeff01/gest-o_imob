import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/server/api-response";
import { requireAuth } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import {
  CATEGORIES,
  normalizeBankText,
  suggestTransactionClassification,
  type CategoryName,
  type TransactionCategorySuggestion,
} from "@/lib/utils/bank-parsers";

type DbCategory = {
  id: string;
  name: string;
  department: "VENDA" | "LOCACAO" | "ADMIN" | "AMBOS";
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ monthKey: string }> }
) {
  try {
    await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { monthKey } = await params;
  const range = monthRange(monthKey);
  if (!range) {
    return NextResponse.json({ error: "Mes invalido." }, { status: 400 });
  }

  try {
    const transactions = await prisma.bankTransaction.findMany({
      where: { date: { gte: range.start, lt: range.end } },
      include: { bank_account: true, category: true },
      orderBy: [{ date: "asc" }, { created_at: "asc" }],
    });

    if (transactions.length === 0) {
      return NextResponse.json({ error: "Extrato nao encontrado." }, { status: 404 });
    }

    const mappedTransactions = transactions.map((tx) => {
      const suggestion = suggestTransactionClassification(tx.description, tx.is_credit);
      return {
        id: tx.id,
        date: tx.date.toISOString(),
        description: tx.description,
        amount: Number(tx.amount),
        balance: tx.balance === null ? undefined : Number(tx.balance),
        operationType: tx.operation_type,
        isCredit: tx.is_credit,
        category: tx.is_credit ? suggestion.category : tx.category?.name ?? suggestion.category,
        categoryManual: tx.notes?.includes("Categoria alterada manualmente") ?? false,
        isReconciled: tx.is_reconciled,
        confidence: suggestion.confidence,
        matchedRule: suggestion.matchedRule,
      };
    });

    const totalReceitas = mappedTransactions.filter((tx) => tx.isCredit).reduce((sum, tx) => sum + tx.amount, 0);
    const totalDespesas = mappedTransactions.filter((tx) => !tx.isCredit).reduce((sum, tx) => sum + tx.amount, 0);
    const categorySummary = buildCategorySummary(mappedTransactions);

    return NextResponse.json({
      statement: {
        id: monthKey,
        monthKey,
        label: monthLabel(monthKey),
        bankName: transactions[0]?.bank_account?.bank_name ?? "Conta bancaria",
        transactions: mappedTransactions,
        totalReceitas,
        totalDespesas,
        saldo: totalReceitas - totalDespesas,
      },
      categorySummary,
      categories: await getSelectableCategories(),
    });
  } catch (error) {
    console.error("[extratos/month] detail error:", error);
    return NextResponse.json({ error: "Erro ao carregar extrato." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ monthKey: string }> }
) {
  try {
    await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { monthKey } = await params;
  const body = await request.json();
  const { txId, category } = body as { txId?: string; category?: string };

  if (!txId || !category) {
    return NextResponse.json({ error: "txId e category obrigatorios." }, { status: 400 });
  }

  const range = monthRange(monthKey);
  if (!range) {
    return NextResponse.json({ error: "Mes invalido." }, { status: 400 });
  }

  try {
    const tx = await prisma.bankTransaction.findFirst({
      where: { id: txId, date: { gte: range.start, lt: range.end } },
    });

    if (!tx) {
      return NextResponse.json({ error: "Transacao nao encontrada." }, { status: 404 });
    }

    const categories = await prisma.expenseCategory.findMany({
      where: { is_active: true },
      select: { id: true, name: true, department: true },
    });
    const suggestion = suggestTransactionClassification(category, tx.is_credit);
    const expenseCategory = tx.is_credit ? null : findExpenseCategory(categories, category, suggestion);

    await prisma.bankTransaction.update({
      where: { id: tx.id },
      data: {
        category_id: expenseCategory?.id ?? tx.category_id,
        notes: appendManualCategoryNote(tx.notes, category),
      },
    });

    if (!tx.is_credit && tx.reconciled_with_type === "EXPENSE" && tx.reconciled_with_id && expenseCategory) {
      await prisma.expense.update({
        where: { id: tx.reconciled_with_id },
        data: {
          category_id: expenseCategory.id,
          department: expenseCategory.department,
          notes: appendManualCategoryNote(null, category),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[extratos/month] patch error:", error);
    return NextResponse.json({ error: "Erro ao atualizar categoria." }, { status: 500 });
  }
}

function buildCategorySummary(
  transactions: Array<{ category: string; amount: number; isCredit: boolean }>
) {
  const map = new Map<string, { total: number; count: number; type: "receita" | "despesa"; color: string }>();

  for (const tx of transactions) {
    const categoryInfo = CATEGORIES[tx.category as CategoryName];
    const existing = map.get(tx.category) ?? {
      total: 0,
      count: 0,
      type: tx.isCredit ? "receita" : ((categoryInfo?.type ?? "despesa") as "receita" | "despesa"),
      color: categoryInfo?.color ?? "bg-gray-100 text-gray-800",
    };
    existing.total += tx.amount;
    existing.count++;
    map.set(tx.category, existing);
  }

  return Array.from(map.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total - a.total);
}

async function getSelectableCategories(): Promise<string[]> {
  const dbCategories = await prisma.expenseCategory.findMany({
    where: { is_active: true },
    select: { name: true },
    orderBy: [{ parent_id: "asc" }, { name: "asc" }],
  });

  return Array.from(new Set([...Object.keys(CATEGORIES), ...dbCategories.map((category) => category.name)])).sort();
}

function findExpenseCategory(
  categories: DbCategory[],
  selectedCategory: string,
  suggestion: TransactionCategorySuggestion
): DbCategory | null {
  const candidates = [selectedCategory, ...suggestion.expenseCategoryNames];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeBankText(candidate);
    const exact = categories.find((category) => normalizeBankText(category.name) === normalizedCandidate);
    if (exact) return exact;

    const partial = categories.find((category) => {
      const normalizedName = normalizeBankText(category.name);
      return normalizedName.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedName);
    });
    if (partial) return partial;
  }

  return categories.find((category) => normalizeBankText(category.name).includes("OUTROS")) ?? categories[0] ?? null;
}

function appendManualCategoryNote(existing: string | null, category: string): string {
  const note = `Categoria alterada manualmente para: ${category}.`;
  return existing ? `${existing}\n${note}` : note;
}

function monthRange(monthKey: string): { start: Date; end: Date } | null {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  };
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const labels = [
    "Janeiro",
    "Fevereiro",
    "Marco",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${labels[Number(month) - 1] ?? month} ${year}`;
}
