"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Database, FileOutput, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { PageShell, Stat } from "@/components/shared/page-shell";
import { formatCurrency } from "@/lib/utils";

interface DimobOverview {
  reference: { year: number };
  contracts: { total: number; byStatus: Record<string, number>; monthlyRent: number };
  people: { clients: number; owners: number };
  properties: { total: number };
  financial: { revenues: number };
}

export default function DimobPage() {
  const [overview, setOverview] = useState<DimobOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchOverview() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/financial-overview", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar base DIMOB.");
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar base DIMOB.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOverview();
  }, []);

  const eligibleContracts = overview?.contracts.byStatus.ATIVO ?? 0;
  const canPrepare = eligibleContracts > 0 && (overview?.people.clients ?? 0) > 0 && (overview?.people.owners ?? 0) > 0;

  return (
    <PageShell
      title="DIMOB"
      description="Leitura fiscal conectada a contratos, pessoas, imoveis e valores reais."
      icon={FileOutput}
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
            <p className="font-semibold">Nao foi possivel carregar a base real da DIMOB.</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="Contratos ativos" value={loading ? "..." : eligibleContracts} color="blue" />
        <Stat label="Clientes / proprietarios" value={loading ? "..." : `${overview?.people.clients ?? 0}/${overview?.people.owners ?? 0}`} color="gray" />
        <Stat label="Imoveis cadastrados" value={loading ? "..." : overview?.properties.total ?? 0} color="blue" />
        <Stat label="Aluguel mensal base" value={loading ? "..." : formatCurrency(overview?.contracts.monthlyRent ?? 0)} color="emerald" />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {canPrepare ? "Base real encontrada para conferencia DIMOB" : "Base real ainda incompleta para gerar arquivo DIMOB"}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              A tela ja le contratos, pessoas, imoveis e valores reais. A geracao do arquivo final segue bloqueada ate validar o layout no programa oficial da Receita.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Dependencias reais da declaracao</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            ["Contratos de locacao", eligibleContracts],
            ["Locatarios/clientes", overview?.people.clients ?? 0],
            ["Proprietarios", overview?.people.owners ?? 0],
            ["Imoveis vinculados", overview?.properties.total ?? 0],
            ["Receitas do periodo", formatCurrency(overview?.financial.revenues ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
              <span className="text-sm font-medium text-gray-800">{label}</span>
              <span className="text-sm font-semibold text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <Link href="/contratos" className="inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700">
        Conferir contratos que alimentam a DIMOB
      </Link>
    </PageShell>
  );
}
