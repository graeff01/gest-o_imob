"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { ContractForm } from "./contract-form";

interface Contract {
  id: string;
  contract_number: string;
  contract_type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  rent_value: string | null;
  sale_value: string | null;
  client: { name: string };
  property: { address_street: string; address_number: string | null; address_neighborhood: string };
  consultant: { user: { name: string } } | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDENTE: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  ATIVO: { label: "Ativo", color: "bg-green-100 text-green-700" },
  ENCERRADO: { label: "Encerrado", color: "bg-gray-100 text-gray-600" },
  CANCELADO: { label: "Cancelado", color: "bg-red-100 text-red-600" },
  RENOVADO: { label: "Renovado", color: "bg-blue-100 text-blue-700" },
};

export default function ContratosPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/contracts?${params}`);
    const data = await res.json();
    setContracts(data.contracts || []);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por numero, cliente ou endereco..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          <option value="PENDENTE">Pendente</option>
          <option value="ATIVO">Ativo</option>
          <option value="ENCERRADO">Encerrado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Contrato
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-6">
          <ContractForm
            onSuccess={() => { setShowForm(false); fetchData(); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Numero</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Imovel</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Consultor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Inicio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contracts.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Nenhum contrato cadastrado</td></tr>
                ) : contracts.map((c) => {
                  const st = statusLabels[c.status] || { label: c.status, color: "bg-gray-100 text-gray-500" };
                  const addr = c.property.address_number
                    ? `${c.property.address_street}, ${c.property.address_number}`
                    : c.property.address_street;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.contract_number}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          c.contract_type === "LOCACAO" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {c.contract_type === "LOCACAO" ? "Locacao" : "Venda"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.client.name}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{addr}</td>
                      <td className="px-4 py-3 text-gray-600">{c.consultant?.user.name || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {c.rent_value ? formatCurrency(c.rent_value) : c.sale_value ? formatCurrency(c.sale_value) : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(c.start_date)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", st.color)}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
