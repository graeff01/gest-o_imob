"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, BarChart3, CreditCard, FileText, Home, Loader2, Receipt, RefreshCw, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { PageShell, Stat } from "@/components/shared/page-shell";
import { cn, formatCurrency } from "@/lib/utils";

interface DashboardOverview {
  financial: { revenues: number; expenses: number; result: number };
  invoices: { total: number; issuedAmount: number; byStatus: Record<string, number> };
  bank: { transactionCount: number; reconciled: number; pendingReview: number };
  contracts: { total: number; byStatus: Record<string, number>; expiring30Days: number };
  properties: { total: number; byStatus: Record<string, number> };
  people: { clients: number; owners: number };
  commissions: { total: number; count: number; rules: number };
  flow: Array<{ monthKey: string; label: string; revenues: number; expenses: number; result: number }>;
}

const quickLinks = [
  { label: "Financeiro", href: "/financeiro", icon: CreditCard },
  { label: "Notas fiscais", href: "/notas-fiscais", icon: FileText },
  { label: "Extratos", href: "/extratos", icon: Receipt },
  { label: "Contratos", href: "/contratos", icon: ShieldCheck },
  { label: "Pessoas", href: "/pessoas", icon: Users },
  { label: "Imoveis", href: "/imoveis", icon: Home },
];

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchOverview() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/financial-overview", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar painel.");
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar painel.");
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
      title="Painel"
      description="Visao executiva conectada aos dados reais do sistema."
      icon={TrendingUp}
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
            href="/release-atual"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ShieldCheck className="h-4 w-4" />
            Release atual
          </Link>
        </>
      }
    >
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Nao foi possivel carregar dados reais.</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="Resultado do mes" value={loading ? "..." : formatCurrency(result)} color={result >= 0 ? "emerald" : "rose"} />
        <Stat label="Receitas reais" value={loading ? "..." : formatCurrency(overview?.financial.revenues ?? 0)} color="emerald" />
        <Stat label="Despesas reais" value={loading ? "..." : formatCurrency(overview?.financial.expenses ?? 0)} color="rose" />
        <Stat label="NFS-e emitidas" value={loading ? "..." : formatCurrency(overview?.invoices.issuedAmount ?? 0)} color="blue" />
      </div>

      {overview && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900">Fluxo financeiro real</h2>
            </div>
            <div className="space-y-3">
              {overview.flow.map((item) => {
                const max = Math.max(...overview.flow.map((row) => Math.max(row.revenues, row.expenses)), 1);
                return (
                  <div key={item.monthKey} className="grid grid-cols-[56px_1fr_104px] items-center gap-3 text-xs">
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
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Menus conectados</h2>
            <div className="grid grid-cols-1 gap-2">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm hover:bg-gray-100">
                    <span className="flex items-center gap-2 font-medium text-gray-800">
                      <Icon className="h-4 w-4 text-blue-600" />
                      {link.label}
                    </span>
                    <span className="text-xs text-emerald-600">dados reais</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Stat label="Contratos" value={`${overview.contracts.byStatus.ATIVO ?? 0}/${overview.contracts.total}`} color="blue" />
          <Stat label="Imoveis ativos" value={overview.properties.total} color="blue" />
          <Stat label="Clientes / proprietarios" value={`${overview.people.clients}/${overview.people.owners}`} color="gray" />
          <Stat label="Extratos a revisar" value={overview.bank.pendingReview} color={overview.bank.pendingReview > 0 ? "amber" : "emerald"} />
        </div>
      )}
    </PageShell>
  );
}
