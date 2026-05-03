import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { authErrorResponse } from "@/server/api-response";
import { requireAuth } from "@/server/authz";
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

export async function GET() {
  try {
    await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
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
        { error: "Nenhuma conta bancaria ativa encontrada. Rode o seed ou cadastre uma conta antes de importar." },
        { status: 422 }
      );
    }

    const categories = await prisma.expenseCategory.findMany({
      where: { is_active: true },
      select: { id: true, name: true, department: true },
    });

    const batchId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let imported = 0;
    let skipped = 0;
    let generatedExpenses = 0;
    let generatedRevenues = 0;
    const importErrors: string[] = [];
    const months = new Set<string>();

    for (const tx of parseResult.transactions) {
      const suggestion = suggestTransactionClassification(tx.description, tx.isCredit);
      const expenseCategory = tx.isCredit ? null : findExpenseCategory(categories, suggestion);

      try {
        const createdTx = await prisma.bankTransaction.create({
          data: {
            bank_account_id: bankAccount.id,
            external_id: buildExternalId(tx),
            date: new Date(`${tx.date}T00:00:00`),
            description: tx.description,
            amount: tx.amount,
            balance: tx.balance ?? null,
            doc_number: tx.docNumber ?? buildExternalId(tx).slice(0, 64),
            operation_type: tx.operationType,
            is_credit: tx.isCredit,
            category_id: expenseCategory?.id ?? null,
            import_batch_id: batchId,
            is_reconciled: false,
            notes: buildTransactionNotes(suggestion),
          },
        });

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

  return prisma.bankAccount.findFirst({
    where: { is_active: true },
    orderBy: { created_at: "asc" },
  });
}

function findExpenseCategory(categories: DbCategory[], suggestion: TransactionCategorySuggestion): DbCategory | null {
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
