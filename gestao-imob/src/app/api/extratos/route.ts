import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { authErrorResponse } from "@/server/api-response";
import { AuthError, requireAuth, requireElevatedRole } from "@/server/authz";
import { auditEvent } from "@/server/audit";
import { ensureBankImportSchema } from "@/server/bank-import-schema";
import { appConfig } from "@/server/env";
import { prisma } from "@/lib/prisma";
import {
  detectAndParse,
  normalizeBankText,
  suggestTransactionClassification,
  type ParsedTransaction,
  type TransactionCategorySuggestion,
} from "@/lib/utils/bank-parsers";

type DbCategory = {
  id: string;
  name: string;
  department: "VENDA" | "LOCACAO" | "ADMIN" | "AMBOS";
};

type LearnedRule = {
  id: string;
  normalized_pattern: string;
  kind: string;
  category_id: string | null;
  category_label: string;
  revenue_category: TransactionCategorySuggestion["revenueCategory"] | null;
  department: TransactionCategorySuggestion["department"];
  payment_method: TransactionCategorySuggestion["paymentMethod"] | null;
  confidence: number;
};

const REVIEW_CONFIDENCE_THRESHOLD = 80;

export async function GET() {
  try {
    await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    await ensureBankImportSchema();
    const transactions = await prisma.bankTransaction.findMany({
      include: { bank_account: true, category: true },
      orderBy: [{ date: "desc" }, { created_at: "desc" }],
      take: 5000,
    });

    const grouped = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      const monthKey = toMonthKey(tx.date);
      grouped.set(monthKey, [...(grouped.get(monthKey) ?? []), tx]);
    }

    const months = Array.from(grouped.entries())
      .map(([monthKey, txs]) => {
        const totalReceitas = txs.filter((tx) => tx.is_credit).reduce((sum, tx) => sum + Number(tx.amount), 0);
        const totalDespesas = txs.filter((tx) => !tx.is_credit).reduce((sum, tx) => sum + Number(tx.amount), 0);
        const pendingReview = txs.filter((tx) => tx.needs_review).length;
        const first = txs[0];

        return {
          id: monthKey,
          monthKey,
          label: monthLabel(monthKey),
          bankName: first?.bank_account?.bank_name ?? "Conta bancaria",
          importedAt: first?.created_at?.toISOString() ?? new Date().toISOString(),
          transactionCount: txs.length,
          totalReceitas,
          totalDespesas,
          pendingReview,
          saldo: totalReceitas - totalDespesas,
        };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    return NextResponse.json({ months });
  } catch (error) {
    console.error("[extratos] list error:", error);
    return NextResponse.json({ error: "Erro ao listar extratos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envie como multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const requestedBankAccountId = formData.get("bank_account_id") as string | null;
  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  try {
    await ensureBankImportSchema();
    const content = await readStatementFile(file);
    const parseResult = detectAndParse(content, file.name);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Nenhuma transacao encontrada no arquivo.", errors: parseResult.errors },
        { status: 422 }
      );
    }

    const bankAccount = await resolveBankAccount(requestedBankAccountId, parseResult.bankName);
    if (!bankAccount) {
      return NextResponse.json(
        { error: "Nao foi possivel criar ou localizar uma conta bancaria para importar o extrato." },
        { status: 422 }
      );
    }

    const categories = await ensureImportCategories();
    const learnedRules = await prisma.bankClassificationRule.findMany({
      where: { is_active: true },
      orderBy: [{ use_count: "desc" }, { updated_at: "desc" }],
      select: {
        id: true,
        normalized_pattern: true,
        kind: true,
        category_id: true,
        category_label: true,
        revenue_category: true,
        department: true,
        payment_method: true,
        confidence: true,
      },
    });

    const batchId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let imported = 0;
    let skipped = 0;
    let generatedExpenses = 0;
    let generatedRevenues = 0;
    const importErrors: string[] = [];
    const months = new Set<string>();

    for (const tx of parseResult.transactions) {
      const baseSuggestion = suggestTransactionClassification(tx.description, tx.isCredit);
      const { suggestion, learnedRuleId, learnedCategoryId } = applyLearnedRules(tx, baseSuggestion, learnedRules);
      const needsReview = shouldReview(suggestion);
      const expenseCategory = tx.isCredit
        ? null
        : findExpenseCategory(
            categories,
            needsReview
              ? { ...suggestion, expenseCategoryNames: ["A Classificar", ...suggestion.expenseCategoryNames, "Outros"] }
              : suggestion,
            learnedCategoryId
          );
      const normalizedKey = buildExternalId(tx);

      try {
        const existingTx = await prisma.bankTransaction.findFirst({
          where: {
            bank_account_id: bankAccount.id,
            OR: [
              { normalized_key: normalizedKey },
              {
                date: new Date(`${tx.date}T00:00:00`),
                doc_number: tx.docNumber ?? normalizedKey.slice(0, 64),
                amount: tx.amount,
              },
            ],
          },
          select: { id: true },
        });

        if (existingTx) {
          skipped++;
          continue;
        }

        const createdTx = await prisma.bankTransaction.create({
          data: {
            bank_account_id: bankAccount.id,
            external_id: normalizedKey,
            normalized_key: normalizedKey,
            date: new Date(`${tx.date}T00:00:00`),
            description: tx.description,
            counterparty: suggestion.supplier ?? extractCounterparty(tx.description),
            amount: tx.amount,
            balance: tx.balance ?? null,
            doc_number: tx.docNumber ?? normalizedKey.slice(0, 64),
            operation_type: tx.operationType,
            is_credit: tx.isCredit,
            category_id: expenseCategory?.id ?? null,
            classification_label: suggestion.category,
            classification_rule: learnedRuleId ? `learned:${learnedRuleId}` : suggestion.matchedRule,
            classification_confidence: suggestion.confidence,
            needs_review: needsReview,
            import_batch_id: batchId,
            is_reconciled: false,
            notes: buildTransactionNotes(suggestion),
          },
        });

        if (learnedRuleId) {
          await prisma.bankClassificationRule.update({
            where: { id: learnedRuleId },
            data: { use_count: { increment: 1 } },
          });
        }

        const linkedId = await createFinancialEntryFromTransaction(
          createdTx.id,
          tx,
          suggestion,
          expenseCategory,
          authContext.dbUserId
        );

        if (linkedId) {
          await prisma.bankTransaction.update({
            where: { id: createdTx.id },
            data: {
              is_reconciled: true,
              reconciled_with_type: tx.isCredit ? "REVENUE" : "EXPENSE",
              reconciled_with_id: linkedId,
            },
          });

          if (tx.isCredit) generatedRevenues++;
          else generatedExpenses++;
        }

        months.add(toMonthKey(new Date(`${tx.date}T00:00:00`)));
        imported++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Unique constraint") || message.includes("unique_bank_transaction")) {
          skipped++;
          continue;
        }
        importErrors.push(`${tx.date} ${tx.description}: ${message}`);
      }
    }

    return NextResponse.json(
      {
        message: `${imported} transacao(oes) importada(s), ${generatedExpenses} despesa(s) e ${generatedRevenues} receita(s) geradas.`,
        imported,
        skipped,
        generatedExpenses,
        generatedRevenues,
        batchId,
        bankName: parseResult.bankName,
        accountInfo: parseResult.accountInfo,
        months: Array.from(months).sort().reverse(),
        parseErrors: parseResult.errors,
        importErrors,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[extratos] import error:", error);
    return NextResponse.json({ error: "Erro interno ao importar extrato." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  let userId: string;
  try {
    const ctx = await requireElevatedRole();
    userId = ctx.dbUserId;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[extratos] cleanup auth error:", error);
    return NextResponse.json({ error: "Erro de autenticacao." }, { status: 500 });
  }

  if (!appConfig.isHomolog) {
    return NextResponse.json(
      { error: "Limpeza total de extratos e permitida somente em homologacao." },
      { status: 403 }
    );
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") !== "false";

  try {
    await ensureBankImportSchema();

    const transactions = await prisma.bankTransaction.findMany({
      select: {
        id: true,
        reconciled_with_id: true,
        reconciled_with_type: true,
      },
    });

    const expenseIds = transactions
      .filter((tx) => tx.reconciled_with_type === "EXPENSE" && tx.reconciled_with_id)
      .map((tx) => tx.reconciled_with_id as string);
    const revenueIds = transactions
      .filter((tx) => tx.reconciled_with_type === "REVENUE" && tx.reconciled_with_id)
      .map((tx) => tx.reconciled_with_id as string);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        removable: transactions.length,
        generatedExpenses: expenseIds.length,
        generatedRevenues: revenueIds.length,
        message: "Simulacao concluida. Use ?dryRun=false para remover todos os extratos importados.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const deletedExpenses = expenseIds.length
        ? await tx.expense.deleteMany({ where: { id: { in: expenseIds } } })
        : { count: 0 };
      const deletedRevenues = revenueIds.length
        ? await tx.revenue.deleteMany({ where: { id: { in: revenueIds } } })
        : { count: 0 };
      const deletedTransactions = await tx.bankTransaction.deleteMany({});

      return {
        transactions: deletedTransactions.count,
        expenses: deletedExpenses.count,
        revenues: deletedRevenues.count,
      };
    });

    await auditEvent({
      action: "bank_statement.cleaned",
      actorId: userId,
      entityType: "bank_transaction",
      summary: "Extratos importados removidos em ambiente de homologacao.",
      metadata: result,
    });

    return NextResponse.json({
      deleted: result.transactions,
      deletedExpenses: result.expenses,
      deletedRevenues: result.revenues,
      message: `${result.transactions} transacao(oes), ${result.expenses} despesa(s) e ${result.revenues} receita(s) removida(s).`,
    });
  } catch (error) {
    console.error("[extratos] cleanup error:", error);
    return NextResponse.json({ error: "Erro ao limpar extratos importados." }, { status: 500 });
  }
}

async function ensureImportCategories(): Promise<DbCategory[]> {
  const existing = await prisma.expenseCategory.findMany({
      where: { is_active: true },
      select: { id: true, name: true, department: true },
    });
  if (existing.length > 0) return existing;

  for (const category of [
    { code: "IMPORT.CLASSIFICAR", name: "A Classificar", sort_order: 998 },
    { code: "IMPORT.OUTROS", name: "Outros", sort_order: 999 },
  ]) {
    await prisma.expenseCategory.upsert({
      where: { code: category.code },
      update: { is_active: true },
      create: {
        code: category.code,
        name: category.name,
        department: "AMBOS",
        sort_order: category.sort_order,
      },
    });
  }

  return prisma.expenseCategory.findMany({
    where: { is_active: true },
    select: { id: true, name: true, department: true },
  });
}

async function readStatementFile(file: File): Promise<string> {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "xlsx" || extension === "xls") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) return "";
    return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet], { FS: ";", RS: "\n" });
  }

  return file.text();
}

async function resolveBankAccount(requestedId: string | null, bankName: string) {
  if (requestedId) {
    return prisma.bankAccount.findUnique({ where: { id: requestedId } });
  }

  const normalizedBank = normalizeBankText(bankName);
  const preferredId = normalizedBank.includes("PIPE") ? "pipeimob" : "caixa-economica";
  const preferred = await prisma.bankAccount.findUnique({ where: { id: preferredId } });
  if (preferred?.is_active) return preferred;

  const existing = await prisma.bankAccount.findFirst({
    where: { is_active: true },
    orderBy: { created_at: "asc" },
  });
  if (existing) return existing;

  return prisma.bankAccount.upsert({
    where: { id: preferredId },
    update: { is_active: true },
    create: {
      id: preferredId,
      bank_name: bankName || "Conta bancaria importada",
      bank_code: normalizedBank.includes("PIPE") ? null : "000",
      account_number: normalizedBank.includes("PIPE") ? "principal" : "importada",
      account_type: normalizedBank.includes("PIPE") ? "PLATAFORMA" : "CORRENTE",
    },
  });
}

function findExpenseCategory(
  categories: DbCategory[],
  suggestion: TransactionCategorySuggestion,
  preferredCategoryId?: string | null
): DbCategory | null {
  if (preferredCategoryId) {
    const preferred = categories.find((category) => category.id === preferredCategoryId);
    if (preferred) return preferred;
  }

  for (const wanted of suggestion.expenseCategoryNames) {
    const normalizedWanted = normalizeBankText(wanted);
    const exact = categories.find((category) => normalizeBankText(category.name) === normalizedWanted);
    if (exact) return exact;

    const partial = categories.find((category) => {
      const normalizedName = normalizeBankText(category.name);
      return normalizedName.includes(normalizedWanted) || normalizedWanted.includes(normalizedName);
    });
    if (partial) return partial;
  }

  return (
    categories.find((category) => normalizeBankText(category.name).includes("A CLASSIFICAR")) ??
    categories.find((category) => normalizeBankText(category.name).includes("OUTROS OPERACIONAIS")) ??
    categories.find((category) => normalizeBankText(category.name).includes("OUTROS")) ??
    categories[0] ??
    null
  );
}

async function createFinancialEntryFromTransaction(
  bankTransactionId: string,
  tx: ParsedTransaction,
  suggestion: TransactionCategorySuggestion,
  expenseCategory: DbCategory | null,
  userId: string
): Promise<string | null> {
  const date = new Date(`${tx.date}T00:00:00`);
  const commonNotes = `Gerado automaticamente pelo importador de extrato. Transacao bancaria: ${bankTransactionId}. Regra: ${suggestion.matchedRule}. Confianca: ${suggestion.confidence}%.`;

  if (tx.isCredit) {
    const revenue = await prisma.revenue.create({
      data: {
        category: suggestion.revenueCategory,
        description: tx.description,
        amount: tx.amount,
        date,
        department: suggestion.department,
        reference_month: date.getMonth() + 1,
        reference_year: date.getFullYear(),
        notes: commonNotes,
        created_by: userId,
      },
    });
    return revenue.id;
  }

  if (!expenseCategory) return null;

  const expense = await prisma.expense.create({
    data: {
      category_id: expenseCategory.id,
      description: tx.description,
      amount: tx.amount,
      date,
      paid_date: date,
      department: expenseCategory.department,
      payment_method: suggestion.paymentMethod ?? null,
      status: "PAGO",
      reference_month: date.getMonth() + 1,
      reference_year: date.getFullYear(),
      supplier: suggestion.supplier ?? null,
      notes: commonNotes,
      created_by: userId,
    },
  });

  return expense.id;
}

function buildTransactionNotes(suggestion: TransactionCategorySuggestion): string {
  return `Categoria sugerida: ${suggestion.category}; Regra: ${suggestion.matchedRule}; Confianca: ${suggestion.confidence}%.`;
}

function buildExternalId(tx: ParsedTransaction): string {
  return normalizeBankText(`${tx.date}|${tx.docNumber ?? ""}|${tx.description}|${tx.amount}|${tx.isCredit ? "C" : "D"}`).slice(0, 128);
}

function applyLearnedRules(
  tx: ParsedTransaction,
  suggestion: TransactionCategorySuggestion,
  rules: LearnedRule[]
): { suggestion: TransactionCategorySuggestion; learnedRuleId?: string; learnedCategoryId?: string | null } {
  const normalizedDescription = normalizeBankText(tx.description);
  const kind = tx.isCredit ? "receita" : "despesa";
  const rule = rules.find((candidate) => {
    return candidate.kind === kind && normalizedDescription.includes(candidate.normalized_pattern);
  });

  if (!rule) return { suggestion };

  return {
    learnedRuleId: rule.id,
    learnedCategoryId: rule.category_id,
    suggestion: {
      ...suggestion,
      category: rule.category_label as TransactionCategorySuggestion["category"],
      revenueCategory: rule.revenue_category ?? suggestion.revenueCategory,
      department: rule.department,
      paymentMethod: rule.payment_method ?? suggestion.paymentMethod,
      confidence: Math.max(rule.confidence, 95),
      matchedRule: `learned:${rule.normalized_pattern}`,
    },
  };
}

function shouldReview(suggestion: TransactionCategorySuggestion): boolean {
  return suggestion.confidence < REVIEW_CONFIDENCE_THRESHOLD || suggestion.matchedRule.startsWith("fallback");
}

function extractCounterparty(description: string): string | undefined {
  return description.split(" - ")[0]?.trim().slice(0, 80) || undefined;
}

function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
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
