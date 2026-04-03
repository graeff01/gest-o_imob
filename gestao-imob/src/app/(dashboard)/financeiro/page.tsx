"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { ExpenseForm } from "./expense-form";
import { RevenueForm } from "./revenue-form";

type Tab = "despesas" | "receitas";

interface Expense {
  id: string;
  description: string;
  amount: string;
  date: string;
  status: string;
  department: string;
  supplier: string | null;
  category: { name: string; code: string | null };
}

interface Revenue {
  id: string;
  description: string;
  amount: string;
  date: string;
  category: string;
  department: string;
  contract: { contract_number: string } | null;
}

const now = new Date();

const categoryLabels: Record<string, string> = {
  INTERMEDIACAO: "Intermediacao",
  AGENCIAMENTO: "Agenciamento",
  CAMPANHA_SUCESSO: "Camp. Sucesso",
  CAMPANHA_CAPTACAO: "Camp. Captacao",
  NFSE_ALUGUEL: "NFSe Aluguel",
  ROYALTY: "Royalty",
  OUTRO: "Outro",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDENTE: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  PAGO: { label: "Pago", color: "bg-green-100 text-green-700" },
  VENCIDO: { label: "Vencido", color: "bg-red-100 text-red-600" },
  CANCELADO: { label: "Cancelado", color: "bg-gray-100 text-gray-500" },
};

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState<Tab>("despesas");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showForm, setShowForm] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalRevenues, setTotalRevenues] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ month: String(month), year: String(year) });

    if (activeTab === "despesas") {
      const res = await fetch(`/api/expenses?${params}`);
      const data = await res.json();
      setExpenses(data.expenses || []);
      setTotalExpenses(data.totalAmount || 0);
    } else {
      const res = await fetch(`/api/revenues?${params}`);
      const data = await res.json();
      setRevenues(data.revenues || []);
      setTotalRevenues(data.totalAmount || 0);
    }
    setLoading(false);
  }, [activeTab, month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const months = [
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  return (
    <div>
      {/* Header with month selector */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setActiveTab("despesas"); setShowForm(false); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "despesas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <TrendingDown className="h-4 w-4" />
            Despesas
          </button>
          <button
            onClick={() => { setActiveTab("receitas"); setShowForm(false); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "receitas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <TrendingUp className="h-4 w-4" />
            Receitas
          </button>
        </div>

        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {months.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-3">
          <div className={cn(
            "px-4 py-2 rounded-lg text-sm font-bold",
            activeTab === "despesas" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          )}>
            Total: {formatCurrency(activeTab === "despesas" ? totalExpenses : totalRevenues)}
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {activeTab === "despesas" ? "Nova Despesa" : "Nova Receita"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-6">
          {activeTab === "despesas" ? (
            <ExpenseForm onSuccess={() => { setShowForm(false); fetchData(); }} onCancel={() => setShowForm(false)} />
          ) : (
            <RevenueForm onSuccess={() => { setShowForm(false); fetchData(); }} onCancel={() => setShowForm(false)} />
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === "despesas" ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Descricao</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Fornecedor</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Depto</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhuma despesa neste periodo</td></tr>
                  ) : expenses.map((exp) => {
                    const st = statusLabels[exp.status] || { label: exp.status, color: "" };
                    return (
                      <tr key={exp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">{formatDate(exp.date)}</td>
                        <td className="px-4 py-3 text-gray-600">{exp.category.name}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{exp.description}</td>
                        <td className="px-4 py-3 text-gray-600">{exp.supplier || "-"}</td>
                        <td className="px-4 py-3 text-gray-600">{exp.department}</td>
                        <td className="px-4 py-3 text-right font-medium text-red-600">{formatCurrency(exp.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", st.color)}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Descricao</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Contrato</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Depto</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {revenues.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhuma receita neste periodo</td></tr>
                  ) : revenues.map((rev) => (
                    <tr key={rev.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{formatDate(rev.date)}</td>
                      <td className="px-4 py-3 text-gray-600">{categoryLabels[rev.category] || rev.category}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{rev.description}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{rev.contract?.contract_number || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{rev.department}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(rev.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
