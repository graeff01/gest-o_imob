/**
 * GET  /api/extratos           — lista todos os statements (meses)
 * POST /api/extratos           — upload de extrato OFX/CSV → parse + import
 */

import { NextRequest, NextResponse } from "next/server";
import { detectAndParse } from "@/lib/utils/bank-parsers";
import {
  importTransactions,
  getAllStatements,
} from "@/lib/stores/extrato-store";

export async function GET() {
  const statements = getAllStatements();

  // Resumo por mês
  const months = statements.map((s) => {
    const totalReceitas = s.transactions
      .filter((t) => t.isCredit)
      .reduce((sum, t) => sum + t.amount, 0);
    const totalDespesas = s.transactions
      .filter((t) => !t.isCredit)
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      id: s.id,
      monthKey: s.monthKey,
      label: s.label,
      bankName: s.bankName,
      importedAt: s.importedAt,
      transactionCount: s.transactions.length,
      totalReceitas,
      totalDespesas,
      saldo: totalReceitas - totalDespesas,
    };
  });

  return NextResponse.json({ months });
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envie como multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  // Ler conteúdo como texto
  const content = await file.text();
  const parseResult = detectAndParse(content, file.name);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Nenhuma transação encontrada no arquivo.", errors: parseResult.errors },
      { status: 422 }
    );
  }

  // Importa no store (agrupa por mês automaticamente)
  const statements = importTransactions(
    parseResult.transactions.map((tx) => ({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      balance: tx.balance,
      operationType: tx.operationType,
      isCredit: tx.isCredit,
    })),
    parseResult.bankName,
    parseResult.accountInfo
  );

  return NextResponse.json(
    {
      message: `${parseResult.transactions.length} transações importadas em ${statements.length} mês(es).`,
      imported: parseResult.transactions.length,
      months: statements.map((s) => s.monthKey),
      errors: parseResult.errors,
    },
    { status: 201 }
  );
}
