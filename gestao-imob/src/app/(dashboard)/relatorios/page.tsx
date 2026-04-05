"use client";

import { useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Users,
  Home,
  DollarSign,
  CheckCircle,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  MOCK_FINANCIAL_MONTHLY,
  MOCK_EXPENSE_CATEGORIES_PIE,
  MOCK_REVENUE_BY_TYPE,
  MOCK_EMPLOYEES,
} from "@/lib/mock-data";

const currencyFmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

// Dados de contratos por mês para gráfico de área
const CONTRACTS_MONTHLY = [
  { mes: "Out", novos: 6, encerrados: 2 },
  { mes: "Nov", novos: 8, encerrados: 3 },
  { mes: "Dez", novos: 5, encerrados: 4 },
  { mes: "Jan", novos: 9, encerrados: 2 },
  { mes: "Fev", novos: 7, encerrados: 3 },
  { mes: "Mar", novos: 11, encerrados: 1 },
  { mes: "Abr", novos: 10, encerrados: 2 },
];

// Performance por corretor
const BROKER_PERFORMANCE = [
  { nome: "Lucas R.", locacoes: 8, vendas: 1, receita: 18400 },
  { nome: "Fernanda O.", locacoes: 12, vendas: 0, receita: 26800 },
  { nome: "Rafael S.", locacoes: 3, vendas: 2, receita: 7200 },
  { nome: "Camila S.", locacoes: 5, vendas: 0, receita: 11500 },
];

type ReportType = "financeiro" | "comissoes" | "contratos" | "despesas" | "performance";

function generateCSV(type: ReportType): string {
  switch (type) {
    case "financeiro":
      return [
        "Mês,Receita,Despesa,Lucro",
        ...MOCK_FINANCIAL_MONTHLY.map((d) => `${d.mes},${d.receita},${d.despesa},${d.lucro}`),
      ].join("\n");
    case "comissoes":
      return [
        "Corretor,Locações,Vendas,Receita Intermediada",
        ...BROKER_PERFORMANCE.map((b) => `${b.nome},${b.locacoes},${b.vendas},${b.receita}`),
      ].join("\n");
    case "contratos":
      return [
        "Mês,Novos Contratos,Encerrados",
        ...CONTRACTS_MONTHLY.map((d) => `${d.mes},${d.novos},${d.encerrados}`),
      ].join("\n");
    case "despesas":
      return [
        "Categoria,Valor",
        ...MOCK_EXPENSE_CATEGORIES_PIE.map((d) => `${d.name},${d.value}`),
      ].join("\n");
    case "performance":
      return [
        "Corretor,CPF,Cargo,Tipo,Locações,Vendas,Receita",
        ...BROKER_PERFORMANCE.map((b) => {
          const emp = MOCK_EMPLOYEES.find((e) => e.user.name.startsWith(b.nome.split(" ")[0]));
          return `${b.nome},${emp?.cpf || ""},Consultor,${emp?.contract_type || ""},${b.locacoes},${b.vendas},${b.receita}`;
        }),
      ].join("\n");
  }
}

function downloadCSV(type: ReportType, label: string) {
  const csv = generateCSV(type);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${label.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = useCallback((type: ReportType, label: string) => {
    setDownloading(type);
    // Pequeno delay para mostrar feedback visual
    setTimeout(() => {
      downloadCSV(type, label);
      setDownloading(null);
    }, 400);
  }, []);

  const totalReceita = MOCK_FINANCIAL_MONTHLY.reduce((s, d) => s + d.receita, 0);
  const totalDespesa = MOCK_FINANCIAL_MONTHLY.reduce((s, d) => s + d.despesa, 0);
  const totalLucro = totalReceita - totalDespesa;
  const margemMedia = ((totalLucro / totalReceita) * 100).toFixed(1);
  const totalContratos = CONTRACTS_MONTHLY.reduce((s, d) => s + d.novos, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios & Insights</h1>
          <p className="text-gray-500 text-sm">Análise financeira e operacional — últimos 7 meses</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white text-gray-700">
            <Calendar className="h-4 w-4" />
            Out 2025 — Abr 2026
          </div>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Receita Total", value: currencyFmt(totalReceita), icon: TrendingUp, color: "text-blue-600" },
          { label: "Despesa Total", value: currencyFmt(totalDespesa), icon: TrendingDown, color: "text-red-600" },
          { label: "Margem Média", value: `${margemMedia}%`, icon: DollarSign, color: "text-emerald-600" },
          { label: "Novos Contratos", value: String(totalContratos), icon: FileText, color: "text-indigo-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={cn("h-4 w-4", s.color)} />
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
            <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chart Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolução financeira */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Evolução Financeira Mensal</h3>
            <button
              onClick={() => handleDownload("financeiro", "Relatorio_Financeiro")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              {downloading === "financeiro" ? <CheckCircle className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
              {downloading === "financeiro" ? "Baixado!" : "Exportar CSV"}
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={MOCK_FINANCIAL_MONTHLY}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip formatter={(value) => currencyFmt(Number(value))} />
              <Legend />
              <Bar dataKey="receita" name="Receita" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lucro" name="Lucro" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Despesas por categoria - Pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Despesas por Categoria</h3>
            <button
              onClick={() => handleDownload("despesas", "Despesas_Categoria")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              {downloading === "despesas" ? <CheckCircle className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
              CSV
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={MOCK_EXPENSE_CATEGORIES_PIE} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                {MOCK_EXPENSE_CATEGORIES_PIE.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => currencyFmt(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-1">
            {MOCK_EXPENSE_CATEGORIES_PIE.slice(0, 5).map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-gray-600 truncate max-w-[120px]">{cat.name}</span>
                </div>
                <span className="font-medium text-gray-900">{currencyFmt(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contratos - Area Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Contratos Novos vs Encerrados</h3>
            <button
              onClick={() => handleDownload("contratos", "Contratos_Mensal")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              {downloading === "contratos" ? <CheckCircle className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
              CSV
            </button>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={CONTRACTS_MONTHLY}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="novos" name="Novos" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="encerrados" name="Encerrados" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Performance - Horizontal Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Performance por Corretor</h3>
            <button
              onClick={() => handleDownload("performance", "Performance_Corretores")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              {downloading === "performance" ? <CheckCircle className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
              CSV
            </button>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={BROKER_PERFORMANCE} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} stroke="#94a3b8" width={90} />
              <Tooltip />
              <Legend />
              <Bar dataKey="locacoes" name="Locações" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="vendas" name="Vendas" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Receita por Tipo - Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Composição da Receita</h3>
          <button
            onClick={() => handleDownload("comissoes", "Receita_Composicao")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            {downloading === "comissoes" ? <CheckCircle className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            Exportar CSV
          </button>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={MOCK_REVENUE_BY_TYPE}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip formatter={(value) => currencyFmt(Number(value))} />
            <Bar dataKey="value" name="Valor" radius={[4, 4, 0, 0]}>
              {MOCK_REVENUE_BY_TYPE.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Relatórios rápidos para download */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-gray-400" />
          Exportações Rápidas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: "Relatório Financeiro Mensal", type: "financeiro" as ReportType, icon: DollarSign },
            { label: "Fechamento de Comissões", type: "comissoes" as ReportType, icon: Users },
            { label: "Movimentação de Contratos", type: "contratos" as ReportType, icon: FileText },
            { label: "Despesas por Categoria", type: "despesas" as ReportType, icon: TrendingDown },
            { label: "Performance por Corretor", type: "performance" as ReportType, icon: Users },
          ].map((report) => (
            <button
              key={report.type}
              onClick={() => handleDownload(report.type, report.label)}
              className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left group"
            >
              <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                <report.icon className="h-5 w-5 text-gray-400 group-hover:text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{report.label}</p>
                <p className="text-[10px] text-gray-400">Gerar CSV</p>
              </div>
              {downloading === report.type ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Download className="h-4 w-4 text-gray-300 group-hover:text-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
