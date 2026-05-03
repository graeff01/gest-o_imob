"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, FileClock, FileText, Loader2, RefreshCw, Search, Users } from "lucide-react";
import { EmptyState, PageShell, Stat } from "@/components/shared/page-shell";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface Contract {
  id: string;
  contract_number: string;
  contract_type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  rent_value: string | null;
  sale_value: string | null;
  intermediation_value: string | null;
  agency_value: string | null;
  client: { name: string };
  property: { address_street: string; address_number: string | null; address_neighborhood: string };
  consultant: { user: { name: string } } | null;
}

const statusStyles: Record<string, { label: string; color: string }> = {
  PENDENTE: { label: "Pendente", color: "bg-amber-50 text-amber-700 border-amber-200" },
  ATIVO: { label: "Ativo", color: "bg-green-50 text-green-700 border-green-200" },
  ENCERRADO: { label: "Encerrado", color: "bg-gray-50 text-gray-600 border-gray-200" },
  CANCELADO: { label: "Cancelado", color: "bg-red-50 text-red-700 border-red-200" },
  RENOVADO: { label: "Renovado", color: "bg-blue-50 text-blue-700 border-blue-200" },
};

export default function ContratosPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "100" });
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);

    try {
      const response = await fetch(`/api/contracts?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar contratos.");
      setContracts(data.contracts ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar contratos reais.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const active = contracts.filter((contract) => contract.status === "ATIVO").length;
  const pending = contracts.filter((contract) => contract.status === "PENDENTE").length;
  const monthlyRent = contracts.reduce((sum, contract) => sum + Number(contract.rent_value ?? 0), 0);

  return (
    <PageShell
      title="Contratos"
      description="Contratos reais conectados a clientes, imoveis, receitas, notas e comissoes."
      icon={FileText}
      actions={
        <>
          <button
            type="button"
            onClick={fetchContracts}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
          <Link
            href="/pessoas"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Users className="h-4 w-4" />
            Ver pessoas
          </Link>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="Contratos reais" value={loading ? "..." : total} color="blue" />
        <Stat label="Ativos" value={loading ? "..." : active} color="emerald" />
        <Stat label="Pendentes" value={loading ? "..." : pending} color="amber" />
        <Stat label="Aluguel mensal" value={loading ? "..." : formatCurrency(monthlyRent)} color="blue" />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Nao foi possivel carregar contratos reais.</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") fetchContracts(); }}
              placeholder="Buscar por contrato, cliente ou imovel..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os status</option>
            {Object.entries(statusStyles).map(([key, item]) => (
              <option key={key} value={key}>{item.label}</option>
            ))}
          </select>
          <button onClick={fetchContracts} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Filtrar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando contratos...
          </div>
        ) : contracts.length === 0 ? (
          <EmptyState
            icon={FileClock}
            title="Nenhum contrato real encontrado"
            description="Quando contratos forem cadastrados/importados, eles passam a alimentar financeiro, notas fiscais, comissoes e relatorios."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3">Cliente / imovel</th>
                  <th className="px-4 py-3">Vigencia</th>
                  <th className="px-4 py-3 text-right">Valores</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contracts.map((contract) => {
                  const style = statusStyles[contract.status] ?? { label: contract.status, color: "bg-gray-50 text-gray-600 border-gray-200" };
                  const address = `${contract.property.address_street}${contract.property.address_number ? `, ${contract.property.address_number}` : ""}`;
                  return (
                    <tr key={contract.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-gray-900">{contract.contract_number}</p>
                        <p className="text-xs text-gray-500">{contract.contract_type}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{contract.client.name}</p>
                        <p className="text-xs text-gray-500">{address} - {contract.property.address_neighborhood}</p>
                        {contract.consultant?.user.name && <p className="text-xs text-gray-400">Consultor: {contract.consultant.user.name}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <p>{formatDate(contract.start_date)}</p>
                        <p className="text-xs text-gray-400">{contract.end_date ? `ate ${formatDate(contract.end_date)}` : "sem encerramento"}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(contract.rent_value ?? contract.sale_value ?? 0)}</p>
                        {contract.intermediation_value && <p className="text-xs text-gray-500">Interm.: {formatCurrency(contract.intermediation_value)}</p>}
                        {contract.agency_value && <p className="text-xs text-gray-500">Agenc.: {formatCurrency(contract.agency_value)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", style.color)}>
                          {style.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
