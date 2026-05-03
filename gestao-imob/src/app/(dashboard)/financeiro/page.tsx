"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CreditCard,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { PageShell, Stat } from "@/components/shared/page-shell";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface FinancialOverview {
  reference: { label: string };
  financial: { revenues: number; revenueCount: number; expenses: number; expenseCount: number; result: number };
  invoices: { total: number; totalAmount: number; issuedAmount: number; pendingAmount: number; byStatus: Record<string, number> };
  bank: {
    transactionCount: number;
    credits: number;
    debits: number;
    reconciled: number;
    unreconciled: number;
    pendingReview: number;
    accounts: Array<{ id: string; bank_name: string; account_number: string; current_balance: number }>;
  };
  contracts: { total: number; byStatus: Record<string, number>; expiring30Days: number; monthlyRent: number; intermediation: number };
  commissions: { total: number; count: number; rules: number };
  flow: Array<{ monthKey: string; label: string; revenues: number; expenses: number; result: number }>;
  topExpenseCategories: Array<{ id: string; name: string; total: number; count: number }>;
  revenueCategories: Array<{ category: string; total: number; count: number }>;
  recent: {
    revenues: Array<{ id: string; description: string; amount: number; date: string; category: string }>;
    expenses: Array<{ id: string; description: string; amount: number; date: string; status: string; category: { name: string } }>;
    invoices: Array<{ id: string; client_name: string; amount: number; status: string; updated_at: string; nfse_number: number | null; year_sequence: number | null }>;
    bankTransactions: Array<{ id: string; description: string; amount: number; date: string; is_credit: boolean; is_reconciled: boolean }>;
  };
}

const statusLabels: Record<string, string> = {
  PENDENTE: "Pendente",
  PROCESSANDO: "Processando",
  EMITIDA: "Emitida",
  ENVIADA: "Enviada",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
  ERRO: "Erro",
  ATIVO: "Ativo",
  ENCERRADO: "Encerrado",
};

function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

export default function FinanceiroPage() {
  const [overview, setOverview] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchOverview() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/financial-overview", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar consolidado financeiro.");
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar consolidado financeiro.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOverview();
  }, []);

  const result = overview?.financial.result ?? 0;

  return (
    <PageShell
      title="Financeiro"
      description="Consolidado real de receitas, despesas, notas fiscais, extratos e contratos."
      icon={CreditCard}
      actions={
        <>
          <button
            type="button"
            onClick={fetchOverview}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
          <Link
            href="/extratos"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Receipt className="h-4 w-4" />
            Ver extratos
          </Link>
        </>
      }
    >
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Nao foi possivel carregar o financeiro real.</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label={`Receitas ${overview?.reference.label ?? ""}`} value={loading ? "..." : formatCurrency(overview?.financial.revenues ?? 0)} color="emerald" />
        <Stat label={`Despesas ${overview?.reference.label ?? ""}`} value={loading ? "..." : formatCurrency(overview?.financial.expenses ?? 0)} color="rose" />
        <Stat label="Resultado real" value={loading ? "..." : formatCurrency(result)} color={result >= 0 ? "emerald" : "rose"} />
        <Stat label="Notas emitidas/enviadas/pagas" value={loading ? "..." : formatCurrency(overview?.invoices.issuedAmount ?? 0)} color="blue" />
      </div>

      {overview && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-900">Fluxo dos ultimos 6 meses</h2>
              </div>
              <div className="space-y-3">
                {overview.flow.map((item) => {
                  const max = Math.max(...overview.flow.map((row) => Math.max(row.revenues, row.expenses)), 1);
                  return (
                    <div key={item.monthKey} className="grid grid-cols-[56px_1fr_96px] items-center gap-3 text-xs">
                      <span className="font-medium text-gray-500">{item.label}</span>
                      <div className="space-y-1">
                        <div className="h-2 rounded-full bg-gray-100">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(3, (item.revenues / max) * 100)}%` }} />
                        </div>
                        <div className="h-2 rounded-full bg-gray-100">
                          <div className="h-2 rounded-full bg-rose-500" style={{ width: `${Math.max(3, (item.expenses / max) * 100)}%` }} />
                        </div>
                      </div>
                      <span className={cn("text-right font-semibold", item.result >= 0 ? "text-emerald-700" : "text-rose-600")}>
                        {formatCurrency(item.result)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-900">Extratos e conciliacao</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">Transacoes no mes</span>
                  <span className="font-semibold text-gray-900">{overview.bank.transactionCount}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">Conciliadas</span>
                  <span className="font-semibold text-emerald-700">{overview.bank.reconciled}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">Pendentes</span>
                  <span className="font-semibold text-amber-700">{overview.bank.unreconciled}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">A revisar</span>
                  <span className="font-semibold text-rose-600">{overview.bank.pendingReview}</span>
                </div>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <ArrowDownCircle className="h-5 w-5 text-rose-600" />
                <h2 className="text-sm font-semibold text-gray-900">Despesas por categoria</h2>
              </div>
              <div className="space-y-2">
                {overview.topExpenseCategories.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">Nenhuma despesa no periodo.</p>
                ) : overview.topExpenseCategories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{category.name}</p>
                      <p className="text-xs text-gray-500">{category.count} lancamento(s)</p>
                    </div>
                    <p className="font-semibold text-rose-600">{formatCurrency(category.total)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
                <h2 className="text-sm font-semibold text-gray-900">Receitas por origem</h2>
              </div>
              <div className="space-y-2">
                {overview.revenueCategories.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">Nenhuma receita no periodo.</p>
                ) : overview.revenueCategories.map((category) => (
                  <div key={category.category} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{category.category}</p>
                      <p className="text-xs text-gray-500">{category.count} lancamento(s)</p>
                    </div>
                    <p className="font-semibold text-emerald-700">{formatCurrency(category.total)}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-900">Notas fiscais</h2>
              </div>
              <div className="space-y-2 text-sm">
                {Object.entries(overview.invoices.byStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-gray-600">{statusLabel(status)}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
                <Link href="/notas-fiscais" className="mt-3 inline-flex text-xs font-semibold text-blue-600 hover:text-blue-700">
                  Abrir notas fiscais
                </Link>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-900">Lancamentos recentes</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {[...overview.recent.revenues.map((item) => ({ id: `r-${item.id}`, label: item.description, date: item.date, amount: item.amount, tone: "credit" as const })),
                  ...overview.recent.expenses.map((item) => ({ id: `e-${item.id}`, label: item.description, date: item.date, amount: -item.amount, tone: "debit" as const })),
                  ...overview.recent.invoices.map((item) => ({ id: `n-${item.id}`, label: `NFS-e ${item.nfse_number ?? item.year_sequence ?? ""} - ${item.client_name}`, date: item.updated_at, amount: item.amount, tone: "invoice" as const }))].slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">{formatDate(item.date)}</p>
                    </div>
                    <p className={cn("ml-3 font-semibold", item.tone === "debit" ? "text-rose-600" : "text-emerald-700")}>
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </PageShell>
  );
}
