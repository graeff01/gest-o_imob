"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw, Search, Store, Tags } from "lucide-react";
import { EmptyState, PageShell, Stat } from "@/components/shared/page-shell";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
  category: string;
  totalMoved: number;
  expenseCount: number;
  bankCount: number;
  reconciledCount: number;
  confidence: number;
  lastMovement: string | null;
  source: "DESPESA" | "EXTRATO" | "MISTO";
}

interface SuppliersOverview {
  suppliers: Supplier[];
  summary: { total: number; totalMoved: number; withRules: number; activeRules: number };
}

export default function FornecedoresPage() {
  const [overview, setOverview] = useState<SuppliersOverview | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    try {
      const response = await fetch(`/api/suppliers-overview?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar fornecedores.");
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar fornecedores reais.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const suppliers = overview?.suppliers ?? [];
  const coverage = overview && overview.summary.total > 0
    ? Math.round((overview.summary.withRules / overview.summary.total) * 100)
    : 0;

  return (
    <PageShell
      title="Fornecedores"
      description="Fornecedores inferidos de despesas, extratos, conciliação e regras de classificação."
      icon={Store}
      actions={
        <>
          <button
            onClick={fetchSuppliers}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
          <Link href="/extratos" className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Tags className="h-4 w-4" />
            Regras via extrato
          </Link>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Fornecedores reais" value={loading ? "..." : overview?.summary.total ?? 0} />
        <Stat label="Com categoria" value={loading ? "..." : overview?.summary.withRules ?? 0} color="blue" />
        <Stat label="Total movimentado" value={loading ? "..." : formatCurrency(overview?.summary.totalMoved ?? 0)} color="emerald" />
        <Stat label="Cobertura" value={loading ? "..." : `${coverage}%`} color="amber" />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Nao foi possivel carregar fornecedores reais.</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700">
        Fornecedores agora sao montados a partir de despesas cadastradas, importacoes de extratos e regras de classificacao bancaria.
        A regra padrao deve ser ajustada no fluxo de extratos/categorias para refletir nos proximos lancamentos.
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") fetchSuppliers(); }}
              placeholder="Buscar por nome..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando fornecedores...
          </div>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={Store}
            title="Nenhum fornecedor identificado"
            description="Ao cadastrar despesas ou importar extratos, fornecedores passam a aparecer automaticamente aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Fornecedor</th>
                  <th className="px-4 py-3 text-left">Categoria</th>
                  <th className="px-4 py-3 text-right">Lancamentos</th>
                  <th className="px-4 py-3 text-right">Conciliados</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Confianca</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{supplier.name}</p>
                      <p className="text-xs text-gray-500">
                        Origem: {supplier.source.toLowerCase()} {supplier.lastMovement ? `· Ultimo: ${formatDate(supplier.lastMovement)}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{supplier.category}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{supplier.expenseCount + supplier.bankCount}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{supplier.reconciledCount}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(supplier.totalMoved)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={cn("h-full rounded-full", supplier.confidence >= 80 ? "bg-green-500" : supplier.confidence >= 40 ? "bg-amber-500" : "bg-gray-300")}
                            style={{ width: `${Math.min(supplier.confidence, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500">{supplier.confidence}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
