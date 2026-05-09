import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/server/api-response";
import { auditEvent } from "@/server/audit";
import { requireAuth } from "@/server/authz";
import { ensureBankImportSchema } from "@/server/bank-import-schema";
import { BANK_TRANSACTION_STATUSES, listBankExceptionQueue } from "@/server/bank-operations-service";
import { prisma } from "@/lib/prisma";
import {
  normalizeBankText,
  suggestTransactionClassification,
  type TransactionCategorySuggestion,
} from "@/lib/utils/bank-parsers";

export async function GET() {
  try {
    await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    await ensureBankImportSchema();
    const transactions = await listBankExceptionQueue(300);
    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("[extratos/revisao] list error:", error);
    return NextResponse.json({ error: "Erro ao listar pendencias." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    await ensureBankImportSchema();
    const body = await request.json();
    const txIds = Array.isArray(body.txIds) ? body.txIds.map(String) : [];
    const category = String(body.category ?? "").trim();
    if (txIds.length === 0 || !category) {
      return NextResponse.json({ error: "Informe transacoes e categoria." }, { status: 400 });
    }

    const categories = await prisma.expenseCategory.findMany({
      where: { is_active: true },
      select: { id: true, name: true, department: true },
    });
    const transactions = await prisma.bankTransaction.findMany({ where: { id: { in: txIds } } });

    for (const tx of transactions) {
      const baseSuggestion = suggestTransactionClassification(tx.description, tx.is_credit);
      const selectedSuggestion = classifyManualSelection(category, tx.is_credit, baseSuggestion);
      const expenseCategory = tx.is_credit ? null : findExpenseCategory(categories, category, selectedSuggestion);

      await prisma.bankTransaction.update({
        where: { id: tx.id },
        data: {
          category_id: expenseCategory?.id ?? tx.category_id,
          classification_label: category,
          classification_rule: "manual:bulk-review",
          classification_confidence: 100,
          needs_review: false,
          reviewed_at: new Date(),
          reviewed_by: authContext.dbUserId,
          processing_status: tx.is_reconciled ? BANK_TRANSACTION_STATUSES.RECONCILED : BANK_TRANSACTION_STATUSES.CLASSIFIED_MANUAL,
          status_reason: "Fila de excecoes revisada manualmente.",
          notes: appendManualCategoryNote(tx.notes, category),
        },
      });

      if (!tx.is_credit && tx.reconciled_with_type === "EXPENSE" && tx.reconciled_with_id && expenseCategory) {
        await prisma.expense.update({
          where: { id: tx.reconciled_with_id },
          data: { category_id: expenseCategory.id, department: expenseCategory.department },
        });
      }

      if (tx.is_credit && tx.reconciled_with_type === "REVENUE" && tx.reconciled_with_id) {
        await prisma.revenue.update({
          where: { id: tx.reconciled_with_id },
          data: { category: selectedSuggestion.revenueCategory, department: selectedSuggestion.department },
        });
      }
    }

    await auditEvent({
      action: "bank.review.bulk-classified",
      actorId: authContext.dbUserId,
      actorEmail: authContext.email,
      entityType: "bank_transaction",
      summary: "Fila de excecoes revisada em massa.",
      metadata: {
        txIds,
        category,
        total: transactions.length,
      },
    });

    return NextResponse.json({ updated: transactions.length });
  } catch (error) {
    console.error("[extratos/revisao] update error:", error);
    return NextResponse.json({ error: "Erro ao revisar categorias." }, { status: 500 });
  }
}

function findExpenseCategory(
  categories: Array<{ id: string; name: string; department: "VENDA" | "LOCACAO" | "ADMIN" | "AMBOS" }>,
  selectedCategory: string,
  suggestion: TransactionCategorySuggestion
) {
  const candidates = [selectedCategory, ...suggestion.expenseCategoryNames];
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeBankText(candidate);
    const found = categories.find((category) => {
      const normalizedName = normalizeBankText(category.name);
      return normalizedName === normalizedCandidate || normalizedName.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedName);
    });
    if (found) return found;
  }
  return categories.find((category) => normalizeBankText(category.name).includes("OUTROS")) ?? categories[0] ?? null;
}

function classifyManualSelection(
  category: string,
  isCredit: boolean,
  baseSuggestion: TransactionCategorySuggestion
): TransactionCategorySuggestion {
  if (!isCredit) {
    return { ...baseSuggestion, category: category as TransactionCategorySuggestion["category"], expenseCategoryNames: [category, ...baseSuggestion.expenseCategoryNames], confidence: 100, matchedRule: "manual" };
  }

  const normalized = normalizeBankText(category);
  let revenueCategory: TransactionCategorySuggestion["revenueCategory"] = "OUTRO";
  if (normalized.includes("ALUGUEL")) revenueCategory = "NFSE_ALUGUEL";
  if (normalized.includes("COMISSAO") || normalized.includes("INTERMEDIACAO")) revenueCategory = "INTERMEDIACAO";
  if (normalized.includes("REPASSE") || normalized.includes("ROYALTY")) revenueCategory = "ROYALTY";

  return { ...baseSuggestion, category: category as TransactionCategorySuggestion["category"], revenueCategory, confidence: 100, matchedRule: "manual" };
}

function appendManualCategoryNote(existing: string | null, category: string): string {
  const note = `Categoria revisada em massa para: ${category}.`;
  return existing ? `${existing}\n${note}` : note;
}
