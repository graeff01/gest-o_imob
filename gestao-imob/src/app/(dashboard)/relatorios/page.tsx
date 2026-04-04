"use client";

import { BarChart3, TrendingUp, TrendingDown, PieChart, Calendar, FileText, Download } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

const MOCK_DATA = {
  vendasMensais: [
    { mes: "Jan", valor: 450000 },
    { mes: "Fev", valor: 520000 },
    { mes: "Mar", valor: 480000 },
    { mes: "Abr", valor: 610000 },
  ],
  despesasPorCategoria: [
    { label: "Pessoal", valor: 12000, color: "bg-blue-500" },
    { label: "Marketing", valor: 4500, color: "bg-purple-500" },
    { label: "Manutenção", valor: 8200, color: "bg-amber-500" },
    { label: "Tributos", valor: 15600, color: "bg-red-500" },
  ],
};

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios & Insights</h1>
          <p className="text-gray-500 text-sm">Visão geral do desempenho financeiro e operacional</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 bg-white">
            <Calendar className="h-4 w-4" />
            Jan - Abr 2026
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
            <Download className="h-4 w-4" />
            Exportar Todos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Volume de Vendas / Contratos
            </h3>
            <span className="text-xs text-blue-600 font-medium">Meta: R$ 500k/mês</span>
          </div>

          <div className="flex items-end gap-6 h-64 px-4">
            {MOCK_DATA.vendasMensais.map((d) => (
              <div key={d.mes} className="flex-1 flex flex-col items-center gap-2">
                <div 
                  className="w-full bg-blue-100 rounded-t-lg relative group transition-all hover:bg-blue-200" 
                  style={{ height: `${(d.valor / 700000) * 100}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {formatCurrency(d.valor)}
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-500">{d.mes}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-purple-600" />
            Distribuição de Despesas
          </h3>
          <div className="space-y-4">
            {MOCK_DATA.despesasPorCategoria.map((cat) => (
              <div key={cat.label} className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">{cat.label}</span>
                  <span className="font-bold text-gray-900">{formatCurrency(cat.valor)}</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full transition-all", cat.color)} 
                    style={{ width: `${(cat.valor / 20000) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Ticket Médio", value: "R$ 4.250", trend: "+12%", color: "text-blue-600" },
          { label: "Novos Contratos", value: "18", trend: "+3", color: "text-indigo-600" },
          { label: "Inadimplência", value: "2.4%", trend: "-0.5%", color: "text-green-600" },
          { label: "Margem Operacional", value: "32%", trend: "+2.1%", color: "text-emerald-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <div className="flex items-end justify-between">
              <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
              <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                {stat.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gray-400" />
          Relatórios Disponíveis para Download
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            "Extrato Anual DIMOB 2025",
            "Fechamento de Comissões Q1",
            "Relatório de Ocupação Moinhos",
            "Análise de Custos Operacionais",
            "Performace por Corretor",
          ].map((title) => (
            <div key={title} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-blue-200 transition-colors cursor-pointer group">
              <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                <FileText className="h-5 w-5 text-gray-400 group-hover:text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{title}</p>
                <p className="text-[10px] text-gray-400">Gerado em 02/04/2026</p>
              </div>
              <Download className="h-4 w-4 text-gray-300 group-hover:text-blue-600" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
