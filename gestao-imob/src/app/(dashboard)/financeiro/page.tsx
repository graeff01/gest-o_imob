"use client";

import { useState } from "react";
import { Plus, TrendingUp, TrendingDown, X } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Tab = "despesas" | "receitas";

const MOCK_EXPENSES = [
  { id: "1", date: "2026-04-02", category: "Manutenção", description: "Troca de torneira — Ap 301", supplier: "João Encanador", department: "LOCACAO", amount: 380, status: "PAGO" },
  { id: "2", date: "2026-04-01", category: "Marketing", description: "Impulsionamento Instagram — Abril", supplier: "Agência Digital XYZ", department: "GERAL", amount: 1200, status: "PAGO" },
  { id: "3", date: "2026-04-01", category: "Pessoal", description: "Salário — Lucas Rodrigues (CLT)", supplier: null, department: "LOCACAO", amount: 5800, status: "PAGO" },
  { id: "4", date: "2026-04-01", category: "Pessoal", description: "Salário — Thiago Lima (CLT)", supplier: null, department: "VENDAS", amount: 6200, status: "PAGO" },
  { id: "5", date: "2026-03-28", category: "Tributário", description: "ISSQN março/2026", supplier: "PMPA", department: "GERAL", amount: 2340, status: "PAGO" },
  { id: "6", date: "2026-03-25", category: "Infraestrutura", description: "Plano escritório — internet + FO", supplier: "Claro Empresas", department: "GERAL", amount: 490, status: "PAGO" },
  { id: "7", date: "2026-03-20", category: "Manutenção", description: "Pintura fachada — R. Padre Chagas", supplier: "Pintura Pro Ltda", department: "LOCACAO", amount: 4500, status: "PENDENTE" },
  { id: "8", date: "2026-03-15", category: "Tributário", description: "CSLL — 1° trimestre 2026", supplier: "Receita Federal", department: "GERAL", amount: 3120, status: "PENDENTE" },
];

const MOCK_REVENUES = [
  { id: "1", date: "2026-04-01", category: "AGENCIAMENTO", description: "Taxa de administração — Ap. Goethe 77", contract: "MV-2026-0044", department: "LOCACAO", amount: 1200 },
  { id: "2", date: "2026-04-01", category: "AGENCIAMENTO", description: "Taxa de administração — Av. Independência 1200", contract: "MV-2026-0047", department: "LOCACAO", amount: 420 },
  { id: "3", date: "2026-04-01", category: "AGENCIAMENTO", description: "Taxa de administração — R. Padre Chagas", contract: "MV-2026-0046", department: "LOCACAO", amount: 850 },
  { id: "4", date: "2026-04-01", category: "AGENCIAMENTO", description: "Taxa de administração — R. 24 de Outubro", contract: "MV-2025-0038", department: "LOCACAO", amount: 680 },
  { id: "5", date: "2026-03-20", category: "INTERMEDIACAO", description: "Comissão de intermediação — Contrato MV-2026-0047", contract: "MV-2026-0047", department: "LOCACAO", amount: 8400 },
  { id: "6", date: "2026-03-15", category: "INTERMEDIACAO", description: "Comissão de intermediação — Contrato MV-2026-0046", contract: "MV-2026-0046", department: "LOCACAO", amount: 17000 },
  { id: "7", date: "2026-03-10", category: "NFSE_ALUGUEL", description: "NFSe emitida ref. fevereiro — Construtora Norte", contract: "MV-2026-0044", department: "LOCACAO", amount: 12000 },
  { id: "8", date: "2026-02-28", category: "OUTRO", description: "Multa rescisória — MV-2025-0022", contract: "MV-2025-0022", department: "GERAL", amount: 6400 },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDENTE: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  PAGO: { label: "Pago", color: "bg-green-100 text-green-700" },
  VENCIDO: { label: "Vencido", color: "bg-red-100 text-red-600" },
  CANCELADO: { label: "Cancelado", color: "bg-gray-100 text-gray-500" },
};

const catLabels: Record<string, string> = {
  INTERMEDIACAO: "Intermediação",
  AGENCIAMENTO: "Agenciamento",
  NFSE_ALUGUEL: "NFSe Aluguel",
  CAMPANHA_SUCESSO: "Camp. Sucesso",
  OUTRO: "Outro",
};

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function FinanceiroPage() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<Tab>("despesas");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(false);

  const totalExpenses = MOCK_EXPENSES.reduce((s, e) => s + e.amount, 0);
  const totalRevenues = MOCK_REVENUES.reduce((s, r) => s + r.amount, 0);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowForm(false); }, 1800);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setActiveTab("despesas"); setShowForm(false); }}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "despesas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <TrendingDown className="h-4 w-4" />Despesas
          </button>
          <button
            onClick={() => { setActiveTab("receitas"); setShowForm(false); }}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "receitas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <TrendingUp className="h-4 w-4" />Receitas
          </button>
        </div>

        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-3">
          <div className={cn("px-4 py-2 rounded-lg text-sm font-bold",
            activeTab === "despesas" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          )}>
            Total: {formatCurrency(activeTab === "despesas" ? totalExpenses : totalRevenues)}
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancelar" : (activeTab === "despesas" ? "Nova Despesa" : "Nova Receita")}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{activeTab === "despesas" ? "Nova Despesa" : "Nova Receita"}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <input type="text" placeholder="Descreva o lançamento..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <input type="number" placeholder="0,00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            {activeTab === "despesas" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                  <input type="text" placeholder="Nome do fornecedor" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option>PENDENTE</option><option>PAGO</option>
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contrato Vinculado</label>
                <input type="text" placeholder="Ex: MV-2026-0047" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              {saved ? "✓ Salvo!" : "Salvar"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === "despesas" ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Descrição</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fornecedor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Depto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_EXPENSES.map((exp) => {
                  const st = statusLabels[exp.status] || { label: exp.status, color: "" };
                  return (
                    <tr key={exp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{formatDate(exp.date)}</td>
                      <td className="px-4 py-3 text-gray-600">{exp.category}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{exp.description}</td>
                      <td className="px-4 py-3 text-gray-600">{exp.supplier || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{exp.department}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">{formatCurrency(exp.amount)}</td>
                      <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", st.color)}>{st.label}</span></td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={5} className="px-4 py-3 font-medium text-gray-700 text-sm">Total de Despesas</td>
                  <td className="px-4 py-3 text-right font-bold text-red-700 text-base">{formatCurrency(totalExpenses)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Descrição</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Contrato</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Depto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_REVENUES.map((rev) => (
                  <tr key={rev.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{formatDate(rev.date)}</td>
                    <td className="px-4 py-3 text-gray-600">{catLabels[rev.category] || rev.category}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{rev.description}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{rev.contract || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{rev.department}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">{formatCurrency(rev.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={5} className="px-4 py-3 font-medium text-gray-700 text-sm">Total de Receitas</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700 text-base">{formatCurrency(totalRevenues)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
