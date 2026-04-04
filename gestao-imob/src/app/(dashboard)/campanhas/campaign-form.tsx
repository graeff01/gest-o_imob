"use client";

import { useState } from "react";
import { Check } from "lucide-react";

interface CampaignFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function CampaignForm({ onSuccess, onCancel }: CampaignFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    campaign_type: "SUCESSO_LOCACAO",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    reward_type: "FIXO",
    reward_amount: "",
    description: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Erro ao salvar campanha");

      onSuccess();
    } catch (error) {
      console.error(error);
      alert("Erro ao criar campanha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Nova Campanha Vigente</h3>
        <p className="text-sm text-gray-500 mt-1">Configure o premiacao baseada em metas ou sucesso nas locacoes e captacoes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Campanha *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="Ex: Campanha de Inverno 2026"
          />
        </div>

        <div>
           <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Meta *</label>
           <select
             required
             value={formData.campaign_type}
             onChange={(e) => setFormData({ ...formData, campaign_type: e.target.value })}
             className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
           >
             <option value="SUCESSO_LOCACAO">Sucesso em Locacao</option>
             <option value="CAPTACAO">Captacao</option>
             <option value="LOCACAO_SEMESTRAL">Locacao Semestral</option>
           </select>
        </div>

        <div>
           <label className="block text-sm font-medium text-gray-700 mb-1">Data de Inicio *</label>
           <input
             type="date"
             required
             value={formData.start_date}
             onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
             className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
           />
        </div>

        <div>
           <label className="block text-sm font-medium text-gray-700 mb-1">Data de Encerramento (Opcional)</label>
           <input
             type="date"
             value={formData.end_date}
             onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
             className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
           />
        </div>
        
        {/* Fill empty space */}
        <div className="hidden md:block"></div>

        <div>
           <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Premio *</label>
           <select
             required
             value={formData.reward_type}
             onChange={(e) => setFormData({ ...formData, reward_type: e.target.value })}
             className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
           >
             <option value="FIXO">Valor Fixo (R$)</option>
             <option value="PERCENTUAL">Percentual (%)</option>
           </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
             {formData.reward_type === 'FIXO' ? "Valor do Premio (R$) *" : "Porcentagem do Premio (%) *"}
          </label>
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={formData.reward_amount}
            onChange={(e) => setFormData({ ...formData, reward_amount: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder={formData.reward_type === 'FIXO' ? "Ex: 100.00" : "Ex: 5.0"}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {loading ? "Salvando..." : (
            <>
              <Check className="h-4 w-4" /> Salvar Campanha
            </>
          )}
        </button>
      </div>
    </form>
  );
}
