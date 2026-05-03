"use client";

import Link from "next/link";
import { CreditCard, Database, FileClock, Receipt, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { EmptyState, PageShell, Stat } from "@/components/shared/page-shell";

const FINANCIAL_SOURCES = [
  "Despesas importadas de extratos",
  "Receitas conciliadas por extrato",
  "Notas fiscais emitidas",
  "Repasses e comissoes consolidados",
];

export default function FinanceiroPage() {
  return (
    <PageShell
      title="Financeiro"
      description="Tela preparada para dados reais. Valores demonstrativos foram removidos."
      icon={CreditCard}
      actions={
        <Link
          href="/extratos"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Receipt className="h-4 w-4" />
          Ver extratos
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="Despesas reais" value="0" color="rose" />
        <Stat label="Receitas reais" value="0" color="emerald" />
        <Stat label="Resultado real" value="Aguardando banco" color="amber" />
        <Stat label="Lancamentos simulados" value="0" color="blue" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Fontes necessarias</h2>
          </div>
          <div className="space-y-2">
            {FINANCIAL_SOURCES.map((source) => (
              <div key={source} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm font-medium text-gray-800">
                {source}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <FileClock className="h-5 w-5 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Indicadores que voltam com banco real</h2>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Despesas por categoria, status e competencia
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Receitas por origem, contrato e nota fiscal
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <Zap className="h-4 w-4 text-blue-600" />
              Lancamentos importados de extratos com auditoria
            </div>
          </div>
        </div>
      </div>

      <EmptyState
        icon={CreditCard}
        title="Financeiro sem mock"
        description="A tela nao mostra mais valores de exemplo. Ela sera liberada para operacao quando as receitas e despesas estiverem persistindo no banco real."
      />
    </PageShell>
  );
}
