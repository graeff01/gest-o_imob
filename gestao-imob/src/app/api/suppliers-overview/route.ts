import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/server/api-response";
import { requireAuth } from "@/server/authz";
import { ensureFoundationSchema } from "@/server/foundation-schema";

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function normalizeName(value: string | null | undefined) {
  return (value || "Fornecedor nao identificado").trim();
}

export async function GET(request: Request) {
  try {
    await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";

  try {
    await ensureFoundationSchema();
    const [officialSuppliers, expenses, bankTransactions, rules] = await Promise.all([
      prisma.supplier.findMany({
        where: { is_active: true },
        include: { category: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.expense.findMany({
        where: { status: { not: "CANCELADO" } },
        select: {
          id: true,
          supplier: true,
          description: true,
          amount: true,
          date: true,
          status: true,
          category: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: 2000,
      }),
      prisma.bankTransaction.findMany({
        where: { is_credit: false },
        select: {
          id: true,
          counterparty: true,
          description: true,
          amount: true,
          date: true,
          classification_label: true,
          classification_confidence: true,
          is_reconciled: true,
        },
        orderBy: [{ date: "desc" }, { created_at: "desc" }],
        take: 2000,
      }),
      prisma.bankClassificationRule.findMany({
        where: { kind: "despesa", is_active: true },
        select: { id: true, pattern: true, category_label: true, confidence: true, use_count: true },
        orderBy: { use_count: "desc" },
      }),
    ]);

    const map = new Map<string, {
      id: string;
      name: string;
      document: string | null;
      category: string;
      totalMoved: number;
      expenseCount: number;
      bankCount: number;
      reconciledCount: number;
      confidence: number;
      lastMovement: string | null;
      source: "DESPESA" | "EXTRATO" | "MISTO";
    }>();

    function touch(name: string, patch: Partial<ReturnType<typeof map.get> extends infer T ? NonNullable<T> : never>) {
      const key = name.toLowerCase();
      const current = map.get(key) ?? {
        id: key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "fornecedor",
        name,
        document: null,
        category: "A classificar",
        totalMoved: 0,
        expenseCount: 0,
        bankCount: 0,
        reconciledCount: 0,
        confidence: 0,
        lastMovement: null,
        source: "DESPESA" as const,
      };
      map.set(key, { ...current, ...patch });
    }

    for (const supplier of officialSuppliers) {
      touch(supplier.name, {
        id: supplier.id,
        category: supplier.category?.name ?? supplier.default_category ?? "A classificar",
        totalMoved: toNumber(supplier.total_moved),
        expenseCount: supplier.transaction_count,
        confidence: supplier.confidence,
        source: "MISTO",
      });
    }

    for (const expense of expenses) {
      const name = normalizeName(expense.supplier || expense.description.split("-")[0]);
      const current = map.get(name.toLowerCase());
      touch(name, {
        category: expense.category?.name ?? current?.category ?? "A classificar",
        totalMoved: (current?.totalMoved ?? 0) + toNumber(expense.amount),
        expenseCount: (current?.expenseCount ?? 0) + 1,
        confidence: Math.max(current?.confidence ?? 0, expense.supplier ? 90 : 55),
        lastMovement: current?.lastMovement && current.lastMovement > expense.date.toISOString() ? current.lastMovement : expense.date.toISOString(),
        source: current?.source === "EXTRATO" ? "MISTO" : "DESPESA",
      });
    }

    for (const tx of bankTransactions) {
      const name = normalizeName(tx.counterparty || tx.description.split("-")[0]);
      const current = map.get(name.toLowerCase());
      touch(name, {
        category: tx.classification_label ?? current?.category ?? "A classificar",
        totalMoved: (current?.totalMoved ?? 0) + toNumber(tx.amount),
        bankCount: (current?.bankCount ?? 0) + 1,
        reconciledCount: (current?.reconciledCount ?? 0) + (tx.is_reconciled ? 1 : 0),
        confidence: Math.max(current?.confidence ?? 0, tx.classification_confidence ?? 0),
        lastMovement: current?.lastMovement && current.lastMovement > tx.date.toISOString() ? current.lastMovement : tx.date.toISOString(),
        source: current?.source === "DESPESA" ? "MISTO" : "EXTRATO",
      });
    }

    const suppliers = Array.from(map.values())
      .filter((supplier) => !search || supplier.name.toLowerCase().includes(search))
      .sort((a, b) => b.totalMoved - a.totalMoved);

    return NextResponse.json({
      suppliers,
      summary: {
        total: suppliers.length,
        totalMoved: suppliers.reduce((sum, item) => sum + item.totalMoved, 0),
        withRules: suppliers.filter((item) => item.category !== "A classificar").length,
        activeRules: rules.length,
      },
      rules,
    });
  } catch (error) {
    console.error("[suppliers-overview] error:", error);
    return NextResponse.json({ error: "Erro ao consolidar fornecedores reais." }, { status: 500 });
  }
}
