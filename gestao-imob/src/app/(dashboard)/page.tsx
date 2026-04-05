"use client";

import { useMemo } from "react";
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
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  Users,
  FileText,
  Home,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  MOCK_FINANCIAL_MONTHLY,
  MOCK_EXPENSE_CATEGORIES_PIE,
  MOCK_REVENUE_BY_TYPE,
} from "@/lib/mock-data";

// TODO: Em produção, estes dados virão de /api/dashboard
const KPI = {
  faturamentoBruto: 142000,
  repasseMatriz: 99400,
  receitaAgencia: 42600,
  comissoesPagas: 16800,
  lucroLiquido: 25800,
  metaMensal: 150000,
  contratosAtivos: 47,
  imoveisCarteira: 82,
  corretoresAtivos: 6,
  inadimplencia: 2.4,
};

const CORRETOR_STATS = [
  { nome: "Lucas Rodrigues", locacoes: 8, tier: "11%", proximoTier: 10, valor: 18400, tipo: "CLT" },
  { nome: "Fernanda Oliveira", locacoes: 12, tier: "13%", proximoTier: 15, valor: 26800, tipo: "PJ" },
  { nome: "Rafael Souza", locacoes: 3, tier: "10%", proximoTier: 4, valor: 7200, tipo: "CLT" },
  { nome: "Camila Santos", locacoes: 5, tier: "11%", proximoTier: 10, valor: 11500, tipo: "PJ" },
];

const currencyFormatter = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

export default function DashboardPage() {
  const metaPercent = ((KPI.faturamentoBruto / KPI.metaMensal) * 100).toFixed(1);

  const topExpenses = useMemo(
    () => MOCK_EXPENSE_CATEGORIES_PIE.slice(0, 6),
    []
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Executivo</h1>
          <p className="text-sm text-gray-500">Abril 2026 — Resumo de operações</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-xs text-gray-500">Receita retida na unidade</p>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(KPI.receitaAgencia)}</p>
          </div>
          <div className="bg-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <div>
              <p className="text-[10px] text-blue-200">Meta mensal</p>
              <p className="text-sm font-semibold">{metaPercent}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Faturamento Bruto", value: KPI.faturamentoBruto, trend: "+12.4%", up: true, icon: DollarSign },
          { label: "Repasse Matriz (70%)", value: KPI.repasseMatriz, trend: "+5.2%", up: false, icon: Building2 },
          { label: "Comissões Pagas", value: KPI.comissoesPagas, trend: "+8.1%", up: true, icon: Wallet },
          { label: "Lucro Líquido", value: KPI.lucroLiquido, trend: "+18.9%", up: true, icon: TrendingUp, highlight: true },
        ].map((kpi, i) => (
          <div key={i} className={cn(
            "p-5 rounded-xl border transition-colors",
            kpi.highlight ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-900 border-gray-200"
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
            <p className={cn("text-xs mb-1", kpi.highlight ? "text-gray-400" : "text-gray-500")}>{kpi.label}</p>
            <p className="text-2xl font-bold">{formatCurrency(kpi.value)}</p>
          </div>
        ))}
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Contratos ativos", value: KPI.contratosAtivos, icon: FileText, color: "text-blue-600" },
          { label: "Imóveis na carteira", value: KPI.imoveisCarteira, icon: Home, color: "text-emerald-600" },
          { label: "Corretores ativos", value: KPI.corretoresAtivos, icon: Users, color: "text-purple-600" },
          { label: "Inadimplência", value: `${KPI.inadimplencia}%`, icon: AlertTriangle, color: "text-amber-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg">
              <s.icon className={cn("h-4 w-4", s.color)} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolução Mensal - LineChart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Evolução Receita vs Despesa</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={MOCK_FINANCIAL_MONTHLY}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip formatter={(value) => currencyFormatter(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="receita" name="Receita" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="despesa" name="Despesa" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pizza de Despesas */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Despesas por Categoria</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={topExpenses}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {topExpenses.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => currencyFormatter(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {topExpenses.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-gray-600">{cat.name}</span>
                </div>
                <span className="font-medium text-gray-900">{currencyFormatter(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Receita por Tipo - BarChart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Receita por Tipo</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={MOCK_REVENUE_BY_TYPE} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={100} />
              <Tooltip formatter={(value) => currencyFormatter(Number(value))} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {MOCK_REVENUE_BY_TYPE.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Performance dos Corretores */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Percent className="h-5 w-5 text-blue-600" />
              Performance e Tiers
            </h3>
            <span className="text-xs text-gray-400">Abril 2026</span>
          </div>
          <div className="space-y-5">
            {CORRETOR_STATS.map((c, i) => {
              const progresso = (c.locacoes / c.proximoTier) * 100;
              return (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                        {c.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{c.nome}</p>
                        <p className="text-xs text-gray-400">{c.tipo} — Tier {c.tier}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-blue-600">{c.locacoes}/{c.proximoTier} locações</p>
                      <p className="text-xs text-gray-400">{formatCurrency(c.valor)} intermediado</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        progresso >= 100 ? "bg-green-500" : progresso >= 70 ? "bg-blue-500" : "bg-amber-500"
                      )}
                      style={{ width: `${Math.min(progresso, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notificações */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Notificações e Alertas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { title: "Divergência repasse", desc: "Contrato MV-2026-0024: repasse 4% menor que calculado. Verificar com a matriz.", icon: AlertTriangle, color: "text-red-600 bg-red-50 border-red-100" },
            { title: "NF pendente", desc: "Fernanda Oliveira precisa enviar NF até amanhã para pagamento na folha.", icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-100" },
            { title: "Conformidade OK", desc: "Lucas Rodrigues: 100% de conformidade nas 8 notas fiscais do mês.", icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-100" },
          ].map((notif, i) => (
            <div key={i} className={cn("p-4 rounded-lg border flex gap-3", notif.color)}>
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
  );
}
