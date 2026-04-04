"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Trophy, Calendar, DollarSign } from "lucide-react";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { CampaignForm } from "./campaign-form";

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  start_date: string;
  end_date: string | null;
  reward_type: string;
  reward_amount: string;
  status: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  ATIVA: { label: "Ativa", color: "bg-green-100 text-green-700" },
  ENCERRADA: { label: "Encerrada", color: "bg-gray-100 text-gray-600" },
  CANCELADA: { label: "Cancelada", color: "bg-red-100 text-red-600" },
};

const typeLabels: Record<string, string> = {
  SUCESSO_LOCACAO: "Sucesso em Locacao",
  CAPTACAO: "Captacao",
  LOCACAO_SEMESTRAL: "Locacao Semestral",
};

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/campaigns?${params}`);
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar campanhas..."
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
          <option value="ATIVA">Ativa</option>
          <option value="ENCERRADA">Encerrada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Nova Campanha
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <CampaignForm
            onSuccess={() => { setShowForm(false); fetchData(); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando campanhas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome da Campanha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Premio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Periodo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCampaigns.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center">
                      <Trophy className="h-10 w-10 text-gray-300 mb-2" />
                      <p>Nenhuma campanha encontrada.</p>
                    </div>
                  </td></tr>
                ) : filteredCampaigns.map((camp) => {
                  const st = statusLabels[camp.status] || statusLabels["ATIVA"];
                  
                  return (
                    <tr key={camp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        {camp.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {typeLabels[camp.campaign_type] || camp.campaign_type}
                      </td>
                      <td className="px-4 py-3 font-medium text-green-600 flex items-center gap-1">
                        {camp.reward_type === 'FIXO' 
                          ? formatCurrency(camp.reward_amount) 
                          : `${Number(camp.reward_amount)}%`}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                         {formatDate(camp.start_date)} {camp.end_date ? `ate ${formatDate(camp.end_date)}` : '(vigente)'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium w-max", st.color)}>
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
