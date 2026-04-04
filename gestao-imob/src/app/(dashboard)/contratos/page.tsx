"use client";

import { useState } from "react";
import { Plus, Search, FileText, X } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface Contract {
  id: string;
  contract_number: string;
  contract_type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  rent_value: number | null;
  sale_value: number | null;
  client: string;
  property: string;
  neighborhood: string;
  consultant: string | null;
}

const MOCK_CONTRACTS: Contract[] = [
  { id: "1", contract_number: "MV-2026-0047", contract_type: "LOCACAO", status: "ATIVO", start_date: "2026-04-01", end_date: "2027-03-31", rent_value: 4200, sale_value: null, client: "Fernanda Oliveira", property: "Av. Independência, 1200 Ap 301", neighborhood: "Moinhos de Vento", consultant: "Lucas Rodrigues" },
  { id: "2", contract_number: "MV-2026-0046", contract_type: "LOCACAO", status: "ATIVO", start_date: "2026-03-15", end_date: "2027-03-14", rent_value: 8500, sale_value: null, client: "Empresa Delta Ltda", property: "R. Padre Chagas, 302 Sala 5", neighborhood: "Moinhos de Vento", consultant: "Fernanda Lima" },
  { id: "3", contract_number: "MV-2026-0045", contract_type: "LOCACAO", status: "PENDENTE", start_date: "2026-05-01", end_date: "2027-04-30", rent_value: 3800, sale_value: null, client: "Ricardo Almeida", property: "R. Mostardeiro, 555 Ap 12", neighborhood: "Moinhos de Vento", consultant: "Lucas Rodrigues" },
  { id: "4", contract_number: "MV-2026-0044", contract_type: "LOCACAO", status: "ATIVO", start_date: "2026-02-01", end_date: "2027-01-31", rent_value: 12000, sale_value: null, client: "Construtora Norte S.A.", property: "Av. Goethe, 77 Cobertura", neighborhood: "Moinhos de Vento", consultant: "Rafael Souza" },
  { id: "5", contract_number: "MV-2026-0043", contract_type: "LOCACAO", status: "ATIVO", start_date: "2026-01-15", end_date: "2027-01-14", rent_value: 5600, sale_value: null, client: "Ana Carolina Lima", property: "R. Ramiro Barcelos, 820 Ap 401", neighborhood: "Rio Branco", consultant: "Fernanda Lima" },
  { id: "6", contract_number: "MV-2025-0038", contract_type: "LOCACAO", status: "ATIVO", start_date: "2025-10-01", end_date: "2026-09-30", rent_value: 6800, sale_value: null, client: "Bruno Henrique Costa", property: "R. 24 de Outubro, 430", neighborhood: "Moinhos de Vento", consultant: "Lucas Rodrigues" },
  { id: "7", contract_number: "MV-2025-0030", contract_type: "LOCACAO", status: "RENOVADO", start_date: "2025-05-01", end_date: "2026-04-30", rent_value: 4900, sale_value: null, client: "Mariana Santos", property: "Av. Osvaldo Aranha, 1100", neighborhood: "Bom Fim", consultant: "Carla Mendes" },
  { id: "8", contract_number: "MV-2025-0022", contract_type: "LOCACAO", status: "ENCERRADO", start_date: "2024-10-01", end_date: "2025-09-30", rent_value: 3200, sale_value: null, client: "Pedro Augusto Ramos", property: "R. Fernandes Vieira, 210", neighborhood: "Bela Vista", consultant: null },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDENTE: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  ATIVO: { label: "Ativo", color: "bg-green-100 text-green-700" },
  ENCERRADO: { label: "Encerrado", color: "bg-gray-100 text-gray-600" },
  CANCELADO: { label: "Cancelado", color: "bg-red-100 text-red-600" },
  RENOVADO: { label: "Renovado", color: "bg-blue-100 text-blue-700" },
};

export default function ContratosPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Form fields
  const [formData, setFormData] = useState({ client: "", property: "", type: "LOCACAO", value: "", start: "", consultant: "" });
  const [saved, setSaved] = useState(false);

  const filtered = MOCK_CONTRACTS.filter((c) => {
    const matchSearch = !search || c.client.toLowerCase().includes(search.toLowerCase()) || c.contract_number.toLowerCase().includes(search.toLowerCase()) || c.property.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowForm(false); }, 2000);
  };

  if (selectedContract) {
    const st = statusLabels[selectedContract.status];
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedContract(null)} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
          ← Voltar para lista
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedContract.contract_number}</h2>
              <span className={cn("px-3 py-1 rounded-full text-xs font-bold mt-2 inline-block", st.color)}>{st.label}</span>
            </div>
            <span className={cn("px-3 py-1 rounded-full text-sm font-medium", selectedContract.contract_type === "LOCACAO" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700")}>
              {selectedContract.contract_type === "LOCACAO" ? "Locação" : "Venda"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {[
              { label: "Cliente / Locatário", value: selectedContract.client },
              { label: "Imóvel", value: `${selectedContract.property} — ${selectedContract.neighborhood}` },
              { label: "Consultor Responsável", value: selectedContract.consultant || "—" },
              { label: "Valor do Aluguel", value: selectedContract.rent_value ? formatCurrency(selectedContract.rent_value) : "—" },
              { label: "Início do Contrato", value: formatDate(selectedContract.start_date) },
              { label: "Término do Contrato", value: selectedContract.end_date ? formatDate(selectedContract.end_date) : "Indeterminado" },
            ].map((f) => (
              <div key={f.label} className="border-b border-gray-100 pb-3">
                <p className="text-xs text-gray-400 mb-1">{f.label}</p>
                <p className="font-medium text-gray-900">{f.value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Editar Contrato</button>
            <button className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">Gerar PDF</button>
            <button className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">Histórico de Pagamentos</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por número, cliente ou endereço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">Todos</option>
          <option value="PENDENTE">Pendente</option>
          <option value="ATIVO">Ativo</option>
          <option value="RENOVADO">Renovado</option>
          <option value="ENCERRADO">Encerrado</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-500">{filtered.length} contratos</span>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancelar" : "Novo Contrato"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Novo Contrato de Locação</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Cliente / Locatário", key: "client", placeholder: "Ex: João Silva" },
              { label: "Endereço do Imóvel", key: "property", placeholder: "Ex: R. XV de Novembro, 200" },
              { label: "Valor do Aluguel (R$)", key: "value", placeholder: "Ex: 3500" },
              { label: "Consultor Responsável", key: "consultant", placeholder: "Ex: Lucas Rodrigues" },
              { label: "Data de Início", key: "start", placeholder: "", type: "date" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={(formData as any)[f.key]}
                  onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Contrato</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="LOCACAO">Locação</option>
                <option value="VENDA">Venda</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancelar</button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              {saved ? "✓ Salvo!" : "Salvar Contrato"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Número</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Imóvel</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Consultor</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Valor/mês</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Início</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Nenhum contrato encontrado</td></tr>
              ) : filtered.map((c) => {
                const st = statusLabels[c.status] || { label: c.status, color: "bg-gray-100 text-gray-500" };
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-blue-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedContract(c)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{c.contract_number}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                        c.contract_type === "LOCACAO" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                      )}>
                        {c.contract_type === "LOCACAO" ? "Locação" : "Venda"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.client}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{c.property}</td>
                    <td className="px-4 py-3 text-gray-600">{c.consultant || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">
                      {c.rent_value ? formatCurrency(c.rent_value) : c.sale_value ? formatCurrency(c.sale_value) : "—"}
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
      </div>
    </div>
  );
}
