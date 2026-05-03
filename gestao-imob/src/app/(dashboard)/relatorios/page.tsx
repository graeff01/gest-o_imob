"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, BarChart3, Download, FileText, Loader2, RefreshCw, ReceiptText } from "lucide-react";
import { PageShell, Stat } from "@/components/shared/page-shell";
import { formatCurrency } from "@/lib/utils";

interface ReportsOverview {
  reference: { label: string };
  financial: { revenues: number; revenueCount: number; expenses: number; expenseCount: number; result: number };
  invoices: { total: number; issuedAmount: number; pendingAmount: number; byStatus: Record<string, number> };
  bank: { transactionCount: number; reconciled: number; unreconciled: number; pendingReview: number };
  contracts: { total: number; byStatus: Record<string, number>; expiring30Days: number; monthlyRent: number };
  commissions: { total: number; count: number; rules: number };
}

export default function RelatoriosPage() {
  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchOverview() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/financial-overview", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar relatorios.");
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar relatorios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOverview();
  }, []);

  const reportCards = overview
    ? [
        {
          title: "Financeiro mensal",
          value: formatCurrency(overview.financial.result),
          detail: `${overview.financial.revenueCount} receita(s) e ${overview.financial.expenseCount} despesa(s) em ${overview.reference.label}.`,
          href: "/financeiro",
        },
        {
          title: "NFS-e",
          value: formatCurrency(overview.invoices.issuedAmount),
          detail: `${overview.invoices.total} nota(s) no periodo; pendente: ${formatCurrency(overview.invoices.pendingAmount)}.`,
          href: "/notas-fiscais",
        },
        {
          title: "Extratos e conciliacao",
          value: `${overview.bank.reconciled}/${overview.bank.transactionCount}`,
          detail: `${overview.bank.unreconciled} transacao(oes) pendente(s), ${overview.bank.pendingReview} a revisar.`,
          href: "/extratos",
        },
        {
          title: "Contratos",
          value: `${overview.contracts.byStatus.ATIVO ?? 0}/${overview.contracts.total}`,
          detail: `${overview.contracts.expiring30Days} contrato(s) vencendo em ate 30 dias.`,
          href: "/contratos",
        },
        {
          title: "Comissoes",
          value: formatCurrency(overview.commissions.total),
          detail: `${overview.commissions.count} fechamento(s) e ${overview.commissions.rules} regra(s) cadastrada(s).`,
          href: "/comissoes",
        },
      ]
    : [];

  return (
    <PageShell
      title="Relatorios"
      description="Central de leitura real das areas conectadas do sistema."
      icon={BarChart3}
      actions={
        <button
          type="button"
          onClick={fetchOverview}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </button>
      }
    >
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Nao foi possivel consolidar relatorios reais.</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Resultado mensal" value={loading ? "..." : formatCurrency(overview?.financial.result ?? 0)} color={(overview?.financial.result ?? 0) >= 0 ? "emerald" : "rose"} />
        <Stat label="NFS-e reconhecida" value={loading ? "..." : formatCurrency(overview?.invoices.issuedAmount ?? 0)} color="blue" />
        <Stat label="Conciliacao bancaria" value={loading ? "..." : `${overview?.bank.reconciled ?? 0}/${overview?.bank.transactionCount ?? 0}`} color="amber" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <ReceiptText className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Relatorios operacionais</h2>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Carregando relatorios...</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {reportCards.map((report) => (
              <Link key={report.title} href={report.href} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4 hover:bg-gray-100">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{report.title}</p>
                  <p className="mt-1 text-lg font-bold text-gray-950">{report.value}</p>
                  <p className="mt-1 text-xs text-gray-500">{report.detail}</p>
                </div>
                <FileText className="h-5 w-5 text-blue-600" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <div className="flex items-start gap-2">
          <Download className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>Exportacoes detalhadas continuam nas telas de origem, como o relatorio mensal de NFS-e em Notas Fiscais. Esta central agora usa os mesmos dados reais para conferencia rapida.</p>
        </div>
      </div>
    </PageShell>
  );
}
