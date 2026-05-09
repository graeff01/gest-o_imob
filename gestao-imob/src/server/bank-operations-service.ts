import "server-only";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/server/audit";

export const BANK_TRANSACTION_STATUSES = {
  IMPORTED: "IMPORTED",
  DUPLICATE_SKIPPED: "DUPLICATE_SKIPPED",
  CLASSIFIED_AUTO: "CLASSIFIED_AUTO",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  CLASSIFIED_MANUAL: "CLASSIFIED_MANUAL",
  POSTED_FINANCIAL: "POSTED_FINANCIAL",
  RECONCILED: "RECONCILED",
  REVERSED: "REVERSED",
  IGNORED: "IGNORED",
} as const;

export type BankTransactionProcessingStatus =
  (typeof BANK_TRANSACTION_STATUSES)[keyof typeof BANK_TRANSACTION_STATUSES];

export function determineBankTransactionStatus(params: {
  duplicate?: boolean;
  needsReview?: boolean;
  isReconciled?: boolean;
  hasFinancialEntry?: boolean;
  manuallyClassified?: boolean;
  reversed?: boolean;
  ignored?: boolean;
}): BankTransactionProcessingStatus {
  if (params.ignored) return BANK_TRANSACTION_STATUSES.IGNORED;
  if (params.reversed) return BANK_TRANSACTION_STATUSES.REVERSED;
  if (params.duplicate) return BANK_TRANSACTION_STATUSES.DUPLICATE_SKIPPED;
  if (params.isReconciled) return BANK_TRANSACTION_STATUSES.RECONCILED;
  if (params.hasFinancialEntry) return BANK_TRANSACTION_STATUSES.POSTED_FINANCIAL;
  if (params.manuallyClassified) return BANK_TRANSACTION_STATUSES.CLASSIFIED_MANUAL;
  if (params.needsReview) return BANK_TRANSACTION_STATUSES.REVIEW_REQUIRED;
  return BANK_TRANSACTION_STATUSES.CLASSIFIED_AUTO;
}

export async function listBankAccountsDashboard() {
  const accounts = await prisma.bankAccount.findMany({
    where: { is_active: true },
    include: {
      transactions: {
        orderBy: [{ date: "desc" }, { created_at: "desc" }],
      },
    },
    orderBy: [{ bank_name: "asc" }, { account_number: "asc" }],
  });

  return accounts.map((account) => {
    const transactions = account.transactions;
    const total = transactions.length;
    const reviewRequired = transactions.filter((tx) => tx.processing_status === BANK_TRANSACTION_STATUSES.REVIEW_REQUIRED).length;
    const reconciled = transactions.filter((tx) => tx.processing_status === BANK_TRANSACTION_STATUSES.RECONCILED).length;
    const lastImportedAt = transactions[0]?.created_at?.toISOString() ?? null;
    const inflow = transactions.filter((tx) => tx.is_credit).reduce((sum, tx) => sum + Number(tx.amount), 0);
    const outflow = transactions.filter((tx) => !tx.is_credit).reduce((sum, tx) => sum + Number(tx.amount), 0);

    return {
      id: account.id,
      bankName: account.bank_name,
      accountNumber: account.account_number,
      accountType: account.account_type,
      currentBalance: Number(account.current_balance),
      totalTransactions: total,
      reviewRequired,
      reconciled,
      autoCoverage: total > 0 ? Math.round(((total - reviewRequired) / total) * 100) : 100,
      inflow,
      outflow,
      lastImportedAt,
    };
  });
}

export async function listBankExceptionQueue(limit = 50) {
  const transactions = await prisma.bankTransaction.findMany({
    where: {
      OR: [
        { processing_status: BANK_TRANSACTION_STATUSES.REVIEW_REQUIRED },
        { needs_review: true },
      ],
    },
    include: { bank_account: true, category: true },
    orderBy: [{ date: "desc" }, { created_at: "desc" }],
    take: limit,
  });

  return transactions.map((tx) => ({
    id: tx.id,
    monthKey: `${tx.date.getUTCFullYear()}-${String(tx.date.getUTCMonth() + 1).padStart(2, "0")}`,
    batchId: tx.import_batch_id,
    date: tx.date.toISOString(),
    description: tx.description,
    amount: Number(tx.amount),
    isCredit: tx.is_credit,
    category: tx.classification_label ?? tx.category?.name ?? "A Classificar",
    confidence: tx.classification_confidence,
    matchedRule: tx.classification_rule,
    bankName: tx.bank_account.bank_name,
    processingStatus: tx.processing_status,
    statusReason: tx.status_reason,
  }));
}

export async function reconcileBankTransaction(params: {
  transactionId: string;
  reconcileType: "REVENUE" | "EXPENSE" | "ADVANCE" | "ROYALTY";
  reconcileWithId?: string | null;
  userId: string;
  actorEmail?: string;
  reason?: string | null;
}) {
  const existing = await prisma.bankTransaction.findUnique({
    where: { id: params.transactionId },
    select: {
      id: true,
      description: true,
      is_reconciled: true,
      reconciled_with_type: true,
      reconciled_with_id: true,
    },
  });

  if (!existing) {
    throw new Error("Transacao bancaria nao encontrada.");
  }
  if (existing.is_reconciled) {
    throw new Error("Esta transacao ja esta conciliada.");
  }

  if (params.reconcileWithId) {
    const conflict = await prisma.bankTransaction.findFirst({
      where: {
        id: { not: params.transactionId },
        is_reconciled: true,
        reconciled_with_type: params.reconcileType,
        reconciled_with_id: params.reconcileWithId,
      },
      select: { id: true, description: true },
    });
    if (conflict) {
      throw new Error("O lancamento financeiro informado ja esta vinculado a outra transacao bancaria.");
    }
  }

  const updated = await prisma.bankTransaction.update({
    where: { id: params.transactionId },
    data: {
      is_reconciled: true,
      reconciled_with_type: params.reconcileType,
      reconciled_with_id: params.reconcileWithId ?? null,
      needs_review: false,
      processing_status: BANK_TRANSACTION_STATUSES.RECONCILED,
      status_reason: params.reason ?? "Conciliado manualmente.",
      reviewed_at: new Date(),
      reviewed_by: params.userId,
    },
  });

  await auditEvent({
    action: "bank.transaction.reconciled",
    actorId: params.userId,
    actorEmail: params.actorEmail,
    entityId: updated.id,
    entityType: "bank_transaction",
    entityLabel: updated.description,
    summary: "Transacao bancaria conciliada manualmente.",
    metadata: {
      reconcileType: params.reconcileType,
      reconcileWithId: params.reconcileWithId ?? null,
      reason: params.reason ?? null,
    },
  });

  return updated;
}

export async function unreconcileBankTransaction(params: {
  transactionId: string;
  userId: string;
  actorEmail?: string;
  reason?: string | null;
}) {
  const existing = await prisma.bankTransaction.findUnique({ where: { id: params.transactionId } });
  if (!existing) {
    throw new Error("Transacao bancaria nao encontrada.");
  }
  if (!existing.is_reconciled) {
    throw new Error("Esta transacao nao esta conciliada.");
  }

  const updated = await prisma.bankTransaction.update({
    where: { id: params.transactionId },
    data: {
      is_reconciled: false,
      reconciled_with_type: null,
      reconciled_with_id: null,
      processing_status: BANK_TRANSACTION_STATUSES.REVERSED,
      status_reason: params.reason ?? "Conciliacao desfeita manualmente.",
      reviewed_at: new Date(),
      reviewed_by: params.userId,
    },
  });

  await auditEvent({
    action: "bank.transaction.unreconciled",
    actorId: params.userId,
    actorEmail: params.actorEmail,
    entityId: updated.id,
    entityType: "bank_transaction",
    entityLabel: updated.description,
    summary: "Conciliacao bancaria desfeita.",
    metadata: {
      previousReconcileType: existing.reconciled_with_type,
      previousReconcileWithId: existing.reconciled_with_id,
      reason: params.reason ?? null,
    },
  });

  return updated;
}
