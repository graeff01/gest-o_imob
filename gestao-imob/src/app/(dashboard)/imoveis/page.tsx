"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { PropertyForm } from "./property-form";

interface Property {
  id: string;
  via_code: string | null;
  address_street: string;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string;
  property_type: string;
  status: string;
  rent_value: string | null;
  sale_value: string | null;
  owner: { name: string };
}

const statusLabels: Record<string, { label: string; color: string }> = {
  DISPONIVEL: { label: "Disponivel", color: "bg-green-100 text-green-700" },
  LOCADO: { label: "Locado", color: "bg-blue-100 text-blue-700" },
  VENDIDO: { label: "Vendido", color: "bg-purple-100 text-purple-700" },
  INATIVO: { label: "Inativo", color: "bg-gray-100 text-gray-500" },
};

const typeLabels: Record<string, string> = {
  APARTAMENTO: "Apto",
  CASA: "Casa",
  COMERCIAL: "Comercial",
  SALA: "Sala",
  TERRENO: "Terreno",
  OUTRO: "Outro",
};

export default function ImoveisPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/properties?${params}`);
    const data = await res.json();
    setProperties(data.properties || []);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function formatAddress(p: Property) {
    let addr = p.address_street;
    if (p.address_number) addr += `, ${p.address_number}`;
    if (p.address_complement) addr += ` - ${p.address_complement}`;
    return addr;
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por endereco, codigo ou bairro..."
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
          <option value="">Todos os status</option>
          <option value="DISPONIVEL">Disponivel</option>
          <option value="LOCADO">Locado</option>
          <option value="VENDIDO">Vendido</option>
          <option value="INATIVO">Inativo</option>
        </select>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Imovel
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-6">
          <PropertyForm
            onSuccess={() => { setShowForm(false); fetchData(); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Codigo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Endereco</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Bairro</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Proprietario</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {properties.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum imovel cadastrado</td></tr>
                ) : properties.map((p) => {
                  const st = statusLabels[p.status] || { label: p.status, color: "bg-gray-100 text-gray-500" };
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.via_code || "-"}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatAddress(p)}</td>
                      <td className="px-4 py-3 text-gray-600">{p.address_neighborhood}</td>
                      <td className="px-4 py-3 text-gray-600">{typeLabels[p.property_type] || p.property_type}</td>
                      <td className="px-4 py-3 text-gray-600">{p.owner.name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {p.rent_value ? formatCurrency(p.rent_value) : p.sale_value ? formatCurrency(p.sale_value) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", st.color)}>
                          {st.label}
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
    </div>
  );
}
