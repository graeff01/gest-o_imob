"use client";

import { useState, useEffect } from "react";

interface Owner {
  id: string;
  name: string;
}

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function PropertyForm({ onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [owners, setOwners] = useState<Owner[]>([]);

  useEffect(() => {
    fetch("/api/property-owners?limit=100")
      .then((r) => r.json())
      .then((data) => setOwners(data.owners || []));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      owner_id: form.get("owner_id"),
      via_code: form.get("via_code") || undefined,
      vista_code: form.get("vista_code") || undefined,
      address_street: form.get("address_street"),
      address_number: form.get("address_number") || undefined,
      address_complement: form.get("address_complement") || undefined,
      address_neighborhood: form.get("address_neighborhood"),
      address_city: form.get("address_city") || "Porto Alegre",
      address_state: form.get("address_state") || "RS",
      address_cep: form.get("address_cep") || undefined,
      property_type: form.get("property_type"),
      rent_value: form.get("rent_value") || undefined,
      sale_value: form.get("sale_value") || undefined,
      area_m2: form.get("area_m2") || undefined,
      bedrooms: form.get("bedrooms") || undefined,
      parking_spots: form.get("parking_spots") || undefined,
      notes: form.get("notes") || undefined,
    };

    const res = await fetch("/api/properties", {
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
      <h3 className="text-lg font-semibold text-gray-900">Novo Imovel</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Proprietario</label>
          <select name="owner_id" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Selecione o proprietario</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <select name="property_type" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Selecione</option>
            <option value="APARTAMENTO">Apartamento</option>
            <option value="CASA">Casa</option>
            <option value="COMERCIAL">Comercial</option>
            <option value="SALA">Sala</option>
            <option value="TERRENO">Terreno</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>
      </div>

      <h4 className="text-sm font-semibold text-gray-700 pt-2">Endereco</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Rua</label>
          <input name="address_street" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Numero</label>
          <input name="address_number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
          <input name="address_complement" placeholder="Apto, Bloco, etc." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
          <input name="address_neighborhood" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
          <input name="address_cep" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
          <input name="address_city" defaultValue="Porto Alegre" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <input name="address_state" defaultValue="RS" maxLength={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <h4 className="text-sm font-semibold text-gray-700 pt-2">Codigos e Valores</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Codigo Via</label>
          <input name="via_code" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Codigo Vista</label>
          <input name="vista_code" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Area (m2)</label>
          <input name="area_m2" type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor Aluguel (R$)</label>
          <input name="rent_value" type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor Venda (R$)</label>
          <input name="sale_value" type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quartos</label>
          <input name="bedrooms" type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vagas</label>
          <input name="parking_spots" type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
