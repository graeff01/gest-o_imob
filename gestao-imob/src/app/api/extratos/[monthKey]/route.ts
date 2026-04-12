/**
 * GET   /api/extratos/[monthKey]  — retorna statement completo com transações
 * PATCH /api/extratos/[monthKey]  — atualiza categoria de uma transação
 */

import { NextRequest, NextResponse } from "next/server";
import { getStatement, updateTransactionCategory } from "@/lib/stores/extrato-store";
import { CATEGORIES, type CategoryName } from "@/lib/utils/bank-parsers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ monthKey: string }> }
) {
  const { monthKey } = await params;
  const statement = getStatement(monthKey);

  if (!statement) {
    return NextResponse.json({ error: "Extrato não encontrado." }, { status: 404 });
  }

  // Resumo por categoria
  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const tx of statement.transactions) {
    const existing = categoryMap.get(tx.category) ?? { total: 0, count: 0 };
    existing.total += tx.amount;
    existing.count++;
    categoryMap.set(tx.category, existing);
  }

  const categorySummary = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      type: CATEGORIES[category as CategoryName]?.type ?? "despesa",
      color: CATEGORIES[category as CategoryName]?.color ?? "bg-gray-100 text-gray-800",
    }))
    .sort((a, b) => b.total - a.total);

  const totalReceitas = statement.transactions
    .filter((t) => t.isCredit)
    .reduce((s, t) => s + t.amount, 0);
  const totalDespesas = statement.transactions
    .filter((t) => !t.isCredit)
    .reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({
    statement: {
      ...statement,
      totalReceitas,
      totalDespesas,
      saldo: totalReceitas - totalDespesas,
    },
    categorySummary,
    categories: Object.keys(CATEGORIES),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ monthKey: string }> }
) {
  const { monthKey } = await params;
  const body = await request.json();
  const { txId, category } = body as { txId: string; category: string };

  if (!txId || !category) {
    return NextResponse.json({ error: "txId e category obrigatórios." }, { status: 400 });
  }

  if (!(category in CATEGORIES)) {
    return NextResponse.json({ error: `Categoria "${category}" inválida.` }, { status: 400 });
  }

  const ok = updateTransactionCategory(monthKey, txId, category as CategoryName);
  if (!ok) {
    return NextResponse.json({ error: "Transação não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
