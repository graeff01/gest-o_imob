import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/server/api-response";
import { auditEvent } from "@/server/audit";
import { requireAuth } from "@/server/authz";
import { ensureBankImportSchema } from "@/server/bank-import-schema";
import { BANK_TRANSACTION_STATUSES, unreconcileBankTransaction } from "@/server/bank-operations-service";
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
    await ensureBankImportSchema();
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
        counterparty: tx.counterparty ?? undefined,
        amount: Number(tx.amount),
        balance: tx.balance === null ? undefined : Number(tx.balance),
        operationType: tx.operation_type,
        isCredit: tx.is_credit,
        category: tx.classification_label ?? (tx.is_credit ? suggestion.category : tx.category?.name ?? suggestion.category),
        categoryManual: tx.notes?.includes("Categoria alterada manualmente") ?? false,
        isReconciled: tx.is_reconciled,
        needsReview: tx.needs_review,
        confidence: tx.classification_confidence || suggestion.confidence,
        matchedRule: tx.classification_rule ?? suggestion.matchedRule,
        processingStatus: tx.processing_status,
        statusReason: tx.status_reason ?? undefined,
        importBatchId: tx.import_batch_id ?? undefined,
        sourceFile: extractNoteValue(tx.notes, "Arquivo"),
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
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { monthKey } = await params;
  const body = await request.json();
  const { txId, category, action } = body as {
    txId?: string;
    category?: string;
    action?: "ignore" | "restore" | "unreconcile";
  };

  if (!txId) {
    return NextResponse.json({ error: "txId obrigatorio." }, { status: 400 });
  }

  const range = monthRange(monthKey);
  if (!range) {
    return NextResponse.json({ error: "Mes invalido." }, { status: 400 });
  }

  try {
    await ensureBankImportSchema();
    const tx = await prisma.bankTransaction.findFirst({
      where: { id: txId, date: { gte: range.start, lt: range.end } },
    });

    if (!tx) {
      return NextResponse.json({ error: "Transacao nao encontrada." }, { status: 404 });
    }

    if (action === "ignore") {
      if (tx.is_reconciled) {
        return NextResponse.json({ error: "Nao e possivel ignorar uma transacao ja conciliada." }, { status: 409 });
      }

      await prisma.bankTransaction.update({
        where: { id: tx.id },
        data: {
          needs_review: false,
          reviewed_at: new Date(),
          reviewed_by: authContext.dbUserId,
          processing_status: BANK_TRANSACTION_STATUSES.IGNORED,
          status_reason: "Transacao ignorada manualmente na revisao.",
        },
      });

      await auditEvent({
        action: "bank.transaction.ignored",
        actorId: authContext.dbUserId,
        actorEmail: authContext.email,
        entityId: tx.id,
        entityType: "bank_transaction",
        entityLabel: tx.description,
        summary: "Transacao bancaria ignorada manualmente.",
        metadata: { monthKey },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "restore") {
      if (tx.is_reconciled) {
        return NextResponse.json({ error: "Nao e possivel recolocar em revisao uma transacao ja conciliada." }, { status: 409 });
      }

      await prisma.bankTransaction.update({
        where: { id: tx.id },
        data: {
          needs_review: true,
          reviewed_at: new Date(),
          reviewed_by: authContext.dbUserId,
          processing_status: BANK_TRANSACTION_STATUSES.REVIEW_REQUIRED,
          status_reason: "Transacao recolocada manualmente na fila de revisao.",
        },
      });

      await auditEvent({
        action: "bank.transaction.restored",
        actorId: authContext.dbUserId,
        actorEmail: authContext.email,
        entityId: tx.id,
        entityType: "bank_transaction",
        entityLabel: tx.description,
        summary: "Transacao bancaria recolocada na fila de revisao.",
        metadata: { monthKey },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "unreconcile") {
      await unreconcileBankTransaction({
        transactionId: tx.id,
        userId: authContext.dbUserId,
        actorEmail: authContext.email,
        reason: "Conciliacao desfeita na revisao mensal do extrato.",
      });

      return NextResponse.json({ success: true });
    }

    if (!category) {
      return NextResponse.json({ error: "category obrigatoria para recategorizacao." }, { status: 400 });
    }

    const categories = await prisma.expenseCategory.findMany({
      where: { is_active: true },
      select: { id: true, name: true, department: true },
    });
    const baseSuggestion = suggestTransactionClassification(tx.description, tx.is_credit);
    const selectedSuggestion = classifyManualSelection(category, tx.is_credit, baseSuggestion);
    const expenseCategory = tx.is_credit ? null : findExpenseCategory(categories, category, selectedSuggestion);
    const normalizedPattern = buildLearnedPattern(tx.counterparty ?? tx.description);

    const learnedRule = await prisma.bankClassificationRule.upsert({
      where: {
        normalized_pattern_kind: {
          normalized_pattern: normalizedPattern,
          kind: tx.is_credit ? "receita" : "despesa",
        },
      },
      update: {
        category_id: expenseCategory?.id ?? null,
        category_label: category,
        revenue_category: tx.is_credit ? selectedSuggestion.revenueCategory : null,
        department: expenseCategory?.department ?? selectedSuggestion.department,
        payment_method: selectedSuggestion.paymentMethod ?? null,
        priority: 20,
        confidence: 100,
        is_active: true,
      },
      create: {
        pattern: tx.counterparty ?? tx.description.slice(0, 80),
        normalized_pattern: normalizedPattern,
        kind: tx.is_credit ? "receita" : "despesa",
        category_id: expenseCategory?.id ?? null,
        category_label: category,
        revenue_category: tx.is_credit ? selectedSuggestion.revenueCategory : null,
        department: expenseCategory?.department ?? selectedSuggestion.department,
        payment_method: selectedSuggestion.paymentMethod ?? null,
        priority: 20,
        confidence: 100,
        created_by: authContext.dbUserId,
      },
    });

    await prisma.bankTransaction.update({
      where: { id: tx.id },
      data: {
        category_id: expenseCategory?.id ?? tx.category_id,
        classification_label: category,
        classification_rule: `learned:${learnedRule.id}`,
        classification_confidence: 100,
        needs_review: false,
        reviewed_at: new Date(),
        reviewed_by: authContext.dbUserId,
        classified_by_rule_id: learnedRule.id,
        processing_status: tx.is_reconciled ? BANK_TRANSACTION_STATUSES.RECONCILED : BANK_TRANSACTION_STATUSES.CLASSIFIED_MANUAL,
        status_reason: "Categoria revisada manualmente no detalhe mensal.",
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

    if (tx.is_credit && tx.reconciled_with_type === "REVENUE" && tx.reconciled_with_id) {
      await prisma.revenue.update({
        where: { id: tx.reconciled_with_id },
        data: {
          category: selectedSuggestion.revenueCategory,
          department: selectedSuggestion.department,
          notes: appendManualCategoryNote(null, category),
        },
      });
    }

    await auditEvent({
      action: "bank.transaction.reclassified",
      actorId: authContext.dbUserId,
      actorEmail: authContext.email,
      entityId: tx.id,
      entityType: "bank_transaction",
      entityLabel: tx.description,
      summary: "Transacao bancaria recategorizada manualmente.",
      metadata: {
        monthKey,
        category,
        reconciledWithType: tx.reconciled_with_type,
        reconciledWithId: tx.reconciled_with_id,
      },
    });

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

function extractNoteValue(notes: string | null | undefined, label: string): string | undefined {
  if (!notes) return undefined;
  const match = notes.match(new RegExp(`${label}:\\s*([^.;\\n]+)`, "i"));
  return match?.[1]?.trim();
}

function classifyManualSelection(
  category: string,
  isCredit: boolean,
  baseSuggestion: TransactionCategorySuggestion
): TransactionCategorySuggestion {
  if (!isCredit) {
    return {
      ...baseSuggestion,
      category: category as TransactionCategorySuggestion["category"],
      expenseCategoryNames: [category, ...baseSuggestion.expenseCategoryNames],
      confidence: 100,
      matchedRule: "manual",
    };
  }

  const normalized = normalizeBankText(category);
  let revenueCategory: TransactionCategorySuggestion["revenueCategory"] = "OUTRO";
  if (normalized.includes("ALUGUEL")) revenueCategory = "NFSE_ALUGUEL";
  if (normalized.includes("COMISSAO") || normalized.includes("INTERMEDIACAO")) revenueCategory = "INTERMEDIACAO";
  if (normalized.includes("REPASSE") || normalized.includes("ROYALTY")) revenueCategory = "ROYALTY";

  return {
    ...baseSuggestion,
    category: category as TransactionCategorySuggestion["category"],
    revenueCategory,
    confidence: 100,
    matchedRule: "manual",
  };
}

function buildLearnedPattern(description: string): string {
  const normalized = normalizeBankText(description);
  const tokens = normalized
    .split(" ")
    .filter((token) => token.length > 2 && !/^\d+$/.test(token))
    .slice(0, 4);
  return (tokens.join(" ") || normalized.slice(0, 60)).slice(0, 80);
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
