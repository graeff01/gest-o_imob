"use client";

import { useState, useEffect } from "react";

interface SelectOption { id: string; label: string; }

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContractForm({ onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<SelectOption[]>([]);
  const [properties, setProperties] = useState<SelectOption[]>([]);
  const [employees, setEmployees] = useState<SelectOption[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/clients?limit=200").then((r) => r.json()),
      fetch("/api/properties?limit=200").then((r) => r.json()),
      fetch("/api/employees?limit=200").then((r) => r.json()),
    ]).then(([cData, pData, eData]) => {
      setClients((cData.clients || []).map((c: { id: string; name: string }) => ({ id: c.id, label: c.name })));
      setProperties((pData.properties || []).map((p: { id: string; address_street: string; address_number: string | null }) => ({
        id: p.id,
        label: p.address_number ? `${p.address_street}, ${p.address_number}` : p.address_street,
      })));
      setEmployees((eData.employees || []).map((e: { id: string; user: { name: string } }) => ({ id: e.id, label: e.user.name })));
    });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      property_id: form.get("property_id"),
      client_id: form.get("client_id"),
      consultant_id: form.get("consultant_id") || undefined,
      captador_id: form.get("captador_id") || undefined,
      contract_type: form.get("contract_type"),
      start_date: form.get("start_date"),
      end_date: form.get("end_date") || undefined,
      rent_value: form.get("rent_value") || undefined,
      sale_value: form.get("sale_value") || undefined,
      intermediation_value: form.get("intermediation_value") || undefined,
      agency_value: form.get("agency_value") || undefined,
      admin_fee_percentage: form.get("admin_fee_percentage") || undefined,
      guarantee_type: form.get("guarantee_type") || undefined,
      notes: form.get("notes") || undefined,
    };

    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao cadastrar");
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Novo Contrato</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <select name="contract_type" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="LOCACAO">Locacao</option>
            <option value="VENDA">Venda</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Garantia</label>
          <select name="guarantee_type" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Nenhuma</option>
            <option value="CAUCAO">Caucao</option>
            <option value="FIADOR">Fiador</option>
            <option value="SEGURO_FIANCA">Seguro Fianca</option>
            <option value="TITULO_CAPITALIZACAO">Titulo Capitalizacao</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Imovel</label>
          <select name="property_id" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Selecione</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
          <select name="client_id" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Selecione</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Consultor</label>
          <select name="consultant_id" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Nenhum</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Captador</label>
          <select name="captador_id" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Nenhum</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>
      </div>

      <h4 className="text-sm font-semibold text-gray-700 pt-2">Datas e Valores</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicio</label>
          <input name="start_date" type="date" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
          <input name="end_date" type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Taxa Admin (%)</label>
          <input name="admin_fee_percentage" type="number" step="0.01" defaultValue="10" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor Aluguel (R$)</label>
          <input name="rent_value" type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Intermediacao (R$)</label>
          <input name="intermediation_value" type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Agenciamento (R$)</label>
          <input name="agency_value" type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
        <textarea name="notes" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}
