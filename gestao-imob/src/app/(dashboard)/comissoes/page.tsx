"use client";

import { useState } from "react";
import { Calculator, Percent, Award, Shield, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

type Tab = "rules" | "historico";

const MOCK_RULES = [
  { id: "1", rule_type: "CONSULTOR_INTERMEDIACAO", employee_type: "CLT", min_threshold: 0, max_threshold: null, percentage: "30.00", fixed_amount: null, description: "Comissão padrão consultores CLT" },
  { id: "2", rule_type: "CONSULTOR_INTERMEDIACAO", employee_type: "CONTRACT", min_threshold: 0, max_threshold: null, percentage: "35.00", fixed_amount: null, description: "Comissão consultores PJ/autônomos" },
  { id: "3", rule_type: "CAPTADOR_INTERMEDIACAO", employee_type: null, min_threshold: 0, max_threshold: null, percentage: "20.00", fixed_amount: null, description: "Comissão padrão captadores" },
  { id: "4", rule_type: "CAPTADOR_BONUS", employee_type: null, min_threshold: 5, max_threshold: null, percentage: null, fixed_amount: "500.00", description: "Bônus para captadores acima de 5 contratos/mês" },
  { id: "5", rule_type: "VENDA", employee_type: null, min_threshold: 0, max_threshold: null, percentage: "6.00", fixed_amount: null, description: "Comissão sobre venda direta (imóvel próprio)" },
];

const MOCK_HISTORICO = [
  { mes: "Março/2026", total: 108600, corretores: 5, status: "Exportado" },
  { mes: "Fevereiro/2026", total: 97340, corretores: 5, status: "Exportado" },
  { mes: "Janeiro/2026", total: 84200, corretores: 4, status: "Exportado" },
  { mes: "Dezembro/2025", total: 132500, corretores: 5, status: "Exportado" },
  { mes: "Novembro/2025", total: 91800, corretores: 4, status: "Exportado" },
];

const ruleTypeLabels: Record<string, string> = {
  CONSULTOR_INTERMEDIACAO: "Intermediação — Consultor",
  CAPTADOR_INTERMEDIACAO: "Intermediação — Captador",
  CAPTADOR_BONUS: "Bônus — Captador",
  VENDA: "Venda",
  CAMPANHA_SUCESSO: "Campanha Sucesso",
};

export default function ComissoesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("rules");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNewRule, setShowNewRule] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowNewRule(false); }, 1800);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("rules")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === "rules" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Shield className="h-4 w-4" />Regras Definidas
        </button>
        <button
          onClick={() => setActiveTab("historico")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === "historico" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Calculator className="h-4 w-4" />Histórico de Fechamentos
        </button>
      </div>

      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewRule(!showNewRule)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />Nova Regra
            </button>
          </div>

          {showNewRule && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Adicionar Regra de Comissão</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Regra</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {Object.entries(ruleTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Funcionário</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">Todos</option>
                    <option value="CLT">CLT</option>
                    <option value="CONTRACT">PJ / Contrato</option>
                    <option value="AUTONOMO">Autônomo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">% de Comissão</label>
                  <input type="number" step="0.5" placeholder="Ex: 30" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div className="col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <input type="text" placeholder="Descreva quando esta regra se aplica..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowNewRule(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancelar</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                  {saved ? "✓ Salvo!" : "Salvar Regra"}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo de Regra</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Funcionário</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Gatilho (mín. contratos)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Comissão</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Descrição</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_RULES.map((rule) => (
                  <>
                    <tr
                      key={rule.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpanded(expanded === rule.id ? null : rule.id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                        <Award className="h-4 w-4 text-purple-600" />
                        {ruleTypeLabels[rule.rule_type] || rule.rule_type}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                          rule.employee_type === "CLT" ? "bg-green-100 text-green-700" :
                          rule.employee_type === "CONTRACT" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"
                        )}>
                          {rule.employee_type === "CONTRACT" ? "PJ" : (rule.employee_type || "Todos")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {rule.min_threshold === 0 && !rule.max_threshold ? "Independente" : `≥ ${rule.min_threshold} contratos`}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {rule.percentage
                          ? <span className="flex items-center gap-1 text-blue-600"><Percent className="h-3 w-3" />{Number(rule.percentage).toFixed(1)}%</span>
                          : <span className="text-green-600">{formatCurrency(rule.fixed_amount || "0")}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{rule.description}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {expanded === rule.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </td>
                    </tr>
                    {expanded === rule.id && (
                      <tr key={`${rule.id}-detail`} className="bg-purple-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div><p className="text-gray-500 mb-1">Tipo de Regra</p><p className="font-medium">{ruleTypeLabels[rule.rule_type]}</p></div>
                            <div><p className="text-gray-500 mb-1">Válida desde</p><p className="font-medium">01/01/2025</p></div>
                            <div><p className="text-gray-500 mb-1">Válida até</p><p className="font-medium">Indeterminado</p></div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Editar</button>
                            <button className="px-3 py-1.5 text-xs border border-red-100 rounded-lg text-red-500 hover:bg-red-50">Desativar</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "historico" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Período</th>
                  <th className="text-center px-6 py-3 font-medium text-gray-600">Corretores</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-600">Total Pago</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_HISTORICO.map((h, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{h.mes}</td>
                    <td className="px-6 py-3 text-center text-gray-600">{h.corretores}</td>
                    <td className="px-6 py-3 text-right font-bold text-green-700">{formatCurrency(h.total)}</td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {h.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <a href="/folha-corretores" className="text-xs text-blue-600 hover:underline">
                        Ver Folha →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
            Para gerar a folha do mês atual, acesse{" "}
            <a href="/folha-corretores" className="font-semibold hover:underline">Folha de Corretores →</a>
          </div>
        </div>
      )}
    </div>
  );
}
