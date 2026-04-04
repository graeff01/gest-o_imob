"use client";

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  FileText,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

const DASHBOARD_DATA = {
  FaturamentoBruto: 125400.00,
  RepasseMatriz: 87780.00,
  ReceitaAgencia: 37620.00,
  ComissoesPagas: 14200.00,
  LucroLiquido: 23420.00,
  MetaMensal: 150000.00,
};

const CORRETOR_STATS = [
  { nome: "Lucas Rodrigues", locacoes: 8, tier: "11%", proximoTier: 10, bonus: 400 },
  { nome: "Fernanda Oliveira", locacoes: 12, tier: "13%", proximoTier: 15, bonus: 600 },
  { nome: "Rafael Souza", locacoes: 2, tier: "10%", proximoTier: 4, bonus: 100 },
];

export default function DashboardPage() {
  const metaPercent = ((DASHBOARD_DATA.FaturamentoBruto / DASHBOARD_DATA.MetaMensal) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Executivo</h1>
          <p className="text-sm text-gray-500">Resumo de operações do mês atual</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">Saldo retido na unidade</p>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(DASHBOARD_DATA.ReceitaAgencia)}</p>
          </div>
          <div className="bg-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <div>
              <p className="text-[10px] text-blue-200">Meta mensal</p>
              <p className="text-sm font-semibold">{metaPercent}% atingida</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Faturamento Bruto (VGL)", value: DASHBOARD_DATA.FaturamentoBruto, trend: "+12.4%", up: true, icon: DollarSign },
          { label: "Repasse Matriz (70%)", value: DASHBOARD_DATA.RepasseMatriz, trend: "+5.2%", up: false, icon: Building2 },
          { label: "Comissões (Folha)", value: DASHBOARD_DATA.ComissoesPagas, trend: "-2.1%", up: true, icon: Wallet },
          { label: "Lucro Líq. Estimado", value: DASHBOARD_DATA.LucroLiquido, trend: "+18.9%", up: true, icon: TrendingUp, highlight: true },
        ].map((kpi, i) => (
          <div key={i} className={cn(
            "p-5 rounded-xl border transition-colors",
            kpi.highlight
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-900 border-gray-200"
          )}>
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-2 rounded-lg", kpi.highlight ? "bg-white/10" : "bg-gray-50")}>
                <kpi.icon className={cn("h-4 w-4", kpi.highlight ? "text-blue-400" : "text-gray-400")} />
              </div>
              <div className={cn("flex items-center gap-1 text-xs font-medium", kpi.up ? "text-green-500" : "text-red-400")}>
                {kpi.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {kpi.trend}
              </div>
            </div>
            <p className={cn("text-xs mb-1", kpi.highlight ? "text-gray-400" : "text-gray-500")}>
              {kpi.label}
            </p>
            <p className="text-2xl font-bold">{formatCurrency(kpi.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance dos Corretores */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Percent className="h-5 w-5 text-blue-600" />
              Performance e Tiers de Comissão
            </h3>
            <span className="text-xs text-gray-400">Fechamento mensal</span>
          </div>

          <div className="space-y-6">
            {CORRETOR_STATS.map((c, i) => {
              const progresso = (c.locacoes / c.proximoTier) * 100;
              return (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="font-medium text-gray-900">{c.nome}</p>
                      <p className="text-xs text-gray-500">Nível atual: {c.tier}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-blue-600">{c.locacoes} / {c.proximoTier} locações</p>
                      <p className="text-xs text-gray-400">Faltam {c.proximoTier - c.locacoes} para próximo tier</p>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(progresso, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notificações */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-6">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Notificações
          </h3>
          <div className="space-y-3">
            {[
              { title: "Divergência repasse", desc: "Contrato MV-2024 teve repasse 4% menor que o calculado.", icon: AlertTriangle, color: "text-red-600 bg-red-50 border-red-100" },
              { title: "NF pendente", desc: "Fernanda precisa enviar a NF para pagamento de amanhã.", icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-100" },
              { title: "Auditoria OK", desc: "Lucas: 100% de conformidade nas 8 notas do mês.", icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-100" },
            ].map((notif, i) => (
              <div key={i} className={cn("p-3 rounded-lg border flex gap-3", notif.color)}>
                <notif.icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{notif.title}</p>
                  <p className="text-xs opacity-75 mt-0.5">{notif.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
