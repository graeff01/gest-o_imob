"use client";

import { useEffect, useMemo, useState } from "react";
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
  Settings,
  Eye,
  EyeOff,
  X,
  Maximize2,
  Minimize2,
  RotateCcw,
  Check,
  ChevronUp,
  ChevronDown,
  Plus,
  Target,
  Calendar,
  Activity,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  MOCK_FINANCIAL_MONTHLY,
  MOCK_EXPENSE_CATEGORIES_PIE,
  MOCK_REVENUE_BY_TYPE,
} from "@/lib/mock-data";

// ─── Mock Data ─────────────────────────────────────

// Dados vazios — serão populados pelo banco de dados quando conectado
const KPI = {
  faturamentoBruto: 0,
  repasseMatriz: 0,
  receitaAgencia: 0,
  comissoesPagas: 0,
  lucroLiquido: 0,
  metaMensal: 0,
  contratosAtivos: 0,
  imoveisCarteira: 0,
  imoveisOcupados: 0,
  corretoresAtivos: 0,
  inadimplencia: 0,
  inadimplenciaValor: 0,
  contratosVencendo: 0,
  nfsPendentes: 0,
};

const CORRETOR_STATS: { nome: string; locacoes: number; tier: string; proximoTier: number; valor: number; tipo: string }[] = [];
const CONTRATOS_VENCENDO: { numero: string; cliente: string; vencimento: string; valor: number }[] = [];
const INADIMPLENTES: { contrato: string; cliente: string; valor: number; dias: number }[] = [];

const currencyFormatter = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

// ─── Widget definitions ────────────────────────────

type WidgetSize = 1 | 2 | 3 | 4; // colunas em grid de 4

interface WidgetConfig {
  id: string;
  size: WidgetSize;
  visible: boolean;
}

interface WidgetMeta {
  id: string;
  label: string;
  description: string;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  maxSize: WidgetSize;
  category: "kpi" | "chart" | "list";
}

const WIDGETS_META: WidgetMeta[] = [
  { id: "kpi-faturamento", label: "Faturamento Bruto", description: "Total faturado no mês", defaultSize: 1, minSize: 1, maxSize: 2, category: "kpi" },
  { id: "kpi-lucro", label: "Lucro Líquido", description: "Lucro após despesas e repasses", defaultSize: 1, minSize: 1, maxSize: 2, category: "kpi" },
  { id: "kpi-meta", label: "Meta Mensal", description: "Progresso da meta do mês", defaultSize: 1, minSize: 1, maxSize: 2, category: "kpi" },
  { id: "kpi-inadimplencia", label: "Inadimplência", description: "Taxa e valor inadimplente", defaultSize: 1, minSize: 1, maxSize: 2, category: "kpi" },
  { id: "kpi-ocupacao", label: "Taxa de Ocupação", description: "% de imóveis ocupados", defaultSize: 1, minSize: 1, maxSize: 2, category: "kpi" },
  { id: "kpi-repasse", label: "Repasse Matriz", description: "Valor repassado à matriz (70%)", defaultSize: 1, minSize: 1, maxSize: 2, category: "kpi" },
  { id: "kpi-comissoes", label: "Comissões Pagas", description: "Total pago a corretores", defaultSize: 1, minSize: 1, maxSize: 2, category: "kpi" },
  { id: "kpi-contratos", label: "Contratos Ativos", description: "Contratos ativos na carteira", defaultSize: 1, minSize: 1, maxSize: 2, category: "kpi" },
  { id: "chart-evolucao", label: "Evolução Mensal", description: "Receita vs Despesa vs Lucro (gráfico)", defaultSize: 3, minSize: 2, maxSize: 4, category: "chart" },
  { id: "chart-despesas", label: "Despesas por Categoria", description: "Pizza das principais categorias", defaultSize: 1, minSize: 1, maxSize: 2, category: "chart" },
  { id: "chart-receita-tipo", label: "Receita por Tipo", description: "Intermediação, Agenciamento, etc", defaultSize: 2, minSize: 2, maxSize: 4, category: "chart" },
  { id: "list-corretores", label: "Performance Corretores", description: "Tiers e progresso dos corretores", defaultSize: 2, minSize: 2, maxSize: 4, category: "list" },
  { id: "list-vencendo", label: "Contratos Vencendo", description: "Próximos 30 dias", defaultSize: 2, minSize: 2, maxSize: 4, category: "list" },
  { id: "list-inadimplentes", label: "Inadimplentes", description: "Contratos em atraso", defaultSize: 2, minSize: 2, maxSize: 4, category: "list" },
  { id: "list-alertas", label: "Alertas e Notificações", description: "Pendências do sistema", defaultSize: 4, minSize: 2, maxSize: 4, category: "list" },
];

const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: "kpi-faturamento", size: 1, visible: true },
  { id: "kpi-lucro", size: 1, visible: true },
  { id: "kpi-meta", size: 1, visible: true },
  { id: "kpi-inadimplencia", size: 1, visible: true },
  { id: "kpi-ocupacao", size: 1, visible: true },
  { id: "kpi-contratos", size: 1, visible: true },
  { id: "kpi-repasse", size: 1, visible: true },
  { id: "kpi-comissoes", size: 1, visible: true },
  { id: "chart-evolucao", size: 3, visible: true },
  { id: "chart-despesas", size: 1, visible: true },
  { id: "chart-receita-tipo", size: 2, visible: true },
  { id: "list-corretores", size: 2, visible: true },
  { id: "list-vencendo", size: 2, visible: true },
  { id: "list-inadimplentes", size: 2, visible: true },
  { id: "list-alertas", size: 4, visible: true },
];

const STORAGE_KEY = "dashboard-layout-v1";

// ─── Page ──────────────────────────────────────────

export default function DashboardPage() {
  const [layout, setLayout] = useState<WidgetConfig[]>(DEFAULT_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WidgetConfig[];
        // Merge with defaults — ensures new widgets added later show up
        const merged = DEFAULT_LAYOUT.map((def) => {
          const found = parsed.find((p) => p.id === def.id);
          return found || def;
        });
        setLayout(merged);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist on change
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      /* ignore */
    }
  }, [layout, mounted]);

  const updateWidget = (id: string, patch: Partial<WidgetConfig>) => {
    setLayout((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };

  const moveWidget = (id: string, dir: -1 | 1) => {
    setLayout((prev) => {
      const visible = prev.filter((w) => w.visible);
      const vIdx = visible.findIndex((w) => w.id === id);
      const targetVIdx = vIdx + dir;
      if (vIdx < 0 || targetVIdx < 0 || targetVIdx >= visible.length) return prev;
      const targetId = visible[targetVIdx].id;
      const a = prev.findIndex((w) => w.id === id);
      const b = prev.findIndex((w) => w.id === targetId);
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
  };

  const visibleWidgets = layout.filter((w) => w.visible);
  const hiddenCount = layout.length - visibleWidgets.length;

  const metaPercent = ((KPI.faturamentoBruto / KPI.metaMensal) * 100);
  const ocupacaoPercent = ((KPI.imoveisOcupados / KPI.imoveisCarteira) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Executivo</h1>
          <p className="text-sm text-gray-500">Abril 2026 — Visão geral da operação</p>
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <>
              <div className="relative">
                <button
                  onClick={() => setPickerOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Widgets
                  <ChevronDown className="h-3 w-3" />
                </button>
                {pickerOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setPickerOpen(false)} />
                    <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-30 max-h-96 overflow-y-auto">
                      <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-2 py-1">
                          Inserir / remover widgets
                        </p>
                      </div>
                      <div className="p-1">
                        {layout.map((w) => {
                          const meta = WIDGETS_META.find((m) => m.id === w.id);
                          if (!meta) return null;
                          return (
                            <label
                              key={w.id}
                              className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={w.visible}
                                onChange={(e) => updateWidget(w.id, { visible: e.target.checked })}
                                className="mt-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-gray-800">{meta.label}</p>
                                <p className="text-[10px] text-gray-400 truncate">{meta.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={resetLayout}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
              </button>
              {hiddenCount > 0 && (
                <span className="text-xs text-gray-400">
                  {hiddenCount} ocultos
                </span>
              )}
            </>
          )}
          <button
            onClick={() => setEditMode(!editMode)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors",
              editMode
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            )}
          >
            {editMode ? (
              <>
                <Check className="h-3.5 w-3.5" /> Concluir
              </>
            ) : (
              <>
                <Settings className="h-3.5 w-3.5" /> Personalizar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Edit mode panel — widget picker */}
      {editMode && hiddenCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-800 mb-2">Widgets ocultos — clique para exibir:</p>
          <div className="flex flex-wrap gap-2">
            {layout
              .filter((w) => !w.visible)
              .map((w) => {
                const meta = WIDGETS_META.find((m) => m.id === w.id);
                return (
                  <button
                    key={w.id}
                    onClick={() => updateWidget(w.id, { visible: true })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    <Eye className="h-3 w-3" /> {meta?.label}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Grid of widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-min">
        {visibleWidgets.map((w, idx) => {
          const meta = WIDGETS_META.find((m) => m.id === w.id);
          if (!meta) return null;

          return (
            <WidgetContainer
              key={w.id}
              config={w}
              meta={meta}
              editMode={editMode}
              canMoveUp={idx > 0}
              canMoveDown={idx < visibleWidgets.length - 1}
              onMove={(dir) => moveWidget(w.id, dir)}
              onUpdate={(patch) => updateWidget(w.id, patch)}
            >
              {renderWidget(w.id, { metaPercent, ocupacaoPercent })}
            </WidgetContainer>
          );
        })}
      </div>
    </div>
  );
}

// ─── Widget Container ──────────────────────────────

function WidgetContainer({
  config,
  meta,
  editMode,
  canMoveUp,
  canMoveDown,
  onMove,
  onUpdate,
  children,
}: {
  config: WidgetConfig;
  meta: WidgetMeta;
  editMode: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onUpdate: (patch: Partial<WidgetConfig>) => void;
  children: React.ReactNode;
}) {
  const colSpanClass = {
    1: "col-span-1",
    2: "sm:col-span-2",
    3: "sm:col-span-2 lg:col-span-3",
    4: "sm:col-span-2 lg:col-span-4",
  }[config.size];

  const canIncrease = config.size < meta.maxSize;
  const canDecrease = config.size > meta.minSize;

  return (
    <div className={cn("relative group", colSpanClass)}>
      {editMode && (
        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-md p-1">
          {canMoveUp && (
            <button
              onClick={() => onMove(-1)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
              title="Mover para cima"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
          )}
          {canMoveDown && (
            <button
              onClick={() => onMove(1)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
              title="Mover para baixo"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
          {canDecrease && (
            <button
              onClick={() => onUpdate({ size: (config.size - 1) as WidgetSize })}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
              title="Diminuir"
            >
              <Minimize2 className="h-3 w-3" />
            </button>
          )}
          {canIncrease && (
            <button
              onClick={() => onUpdate({ size: (config.size + 1) as WidgetSize })}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
              title="Aumentar"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => onUpdate({ visible: false })}
            className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
            title="Ocultar"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className={cn("h-full transition-all", editMode && "ring-2 ring-blue-300 ring-offset-2 rounded-xl")}>
        {children}
      </div>
    </div>
  );
}

// ─── Widget Renderer ──────────────────────────────

function renderWidget(
  id: string,
  ctx: { metaPercent: number; ocupacaoPercent: number }
): React.ReactNode {
  switch (id) {
    case "kpi-faturamento":
      return (
        <KpiCard
          label="Faturamento Bruto"
          value={formatCurrency(KPI.faturamentoBruto)}
          icon={DollarSign}
          trend="+12.4%"
          trendUp={true}
          color="blue"
        />
      );
    case "kpi-lucro":
      return (
        <KpiCard
          label="Lucro Líquido"
          value={formatCurrency(KPI.lucroLiquido)}
          icon={TrendingUp}
          trend="+18.9%"
          trendUp={true}
          highlight
        />
      );
    case "kpi-meta":
      return (
        <KpiCard
          label="Meta Mensal"
          value={`${ctx.metaPercent.toFixed(1)}%`}
          subtitle={`${formatCurrency(KPI.faturamentoBruto)} de ${formatCurrency(KPI.metaMensal)}`}
          icon={Target}
          progress={ctx.metaPercent}
          color="indigo"
        />
      );
    case "kpi-inadimplencia":
      return (
        <KpiCard
          label="Inadimplência"
          value={`${KPI.inadimplencia}%`}
          subtitle={formatCurrency(KPI.inadimplenciaValor)}
          icon={AlertTriangle}
          color="amber"
        />
      );
    case "kpi-ocupacao":
      return (
        <KpiCard
          label="Taxa de Ocupação"
          value={`${ctx.ocupacaoPercent.toFixed(0)}%`}
          subtitle={`${KPI.imoveisOcupados}/${KPI.imoveisCarteira} imóveis`}
          icon={Home}
          progress={ctx.ocupacaoPercent}
          color="emerald"
        />
      );
    case "kpi-contratos":
      return (
        <KpiCard
          label="Contratos Ativos"
          value={String(KPI.contratosAtivos)}
          subtitle={`${KPI.contratosVencendo} vencendo em 30 dias`}
          icon={FileText}
          color="blue"
        />
      );
    case "kpi-repasse":
      return (
        <KpiCard
          label="Repasse Matriz"
          value={formatCurrency(KPI.repasseMatriz)}
          subtitle="70% do faturamento bruto"
          icon={Building2}
          color="purple"
        />
      );
    case "kpi-comissoes":
      return (
        <KpiCard
          label="Comissões Pagas"
          value={formatCurrency(KPI.comissoesPagas)}
          subtitle={`${KPI.corretoresAtivos} corretores ativos`}
          icon={Wallet}
          color="rose"
        />
      );

    case "chart-evolucao":
      return (
        <ChartCard title="Evolução Financeira Mensal" subtitle="Últimos 7 meses">
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
        </ChartCard>
      );

    case "chart-despesas":
      return (
        <ChartCard title="Despesas por Categoria">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={MOCK_EXPENSE_CATEGORIES_PIE.slice(0, 6)} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                {MOCK_EXPENSE_CATEGORIES_PIE.slice(0, 6).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => currencyFormatter(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {MOCK_EXPENSE_CATEGORIES_PIE.slice(0, 4).map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-gray-600 truncate">{cat.name}</span>
                </div>
                <span className="font-medium text-gray-900">{currencyFormatter(cat.value)}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      );

    case "chart-receita-tipo":
      return (
        <ChartCard title="Receita por Tipo">
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
        </ChartCard>
      );

    case "list-corretores":
      return (
        <ChartCard title="Performance Corretores" icon={Percent}>
          <div className="space-y-4 mt-1">
            {CORRETOR_STATS.map((c, i) => {
              const progresso = (c.locacoes / c.proximoTier) * 100;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-[11px] font-bold text-gray-600 flex-shrink-0">
                        {c.nome.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-xs truncate">{c.nome}</p>
                        <p className="text-[10px] text-gray-400">{c.tipo} · Tier {c.tier}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-xs font-semibold text-blue-600">{c.locacoes}/{c.proximoTier}</p>
                      <p className="text-[10px] text-gray-400">{formatCurrency(c.valor)}</p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
        </ChartCard>
      );

    case "list-vencendo":
      return (
        <ChartCard title="Contratos Vencendo" subtitle="Próximos 30 dias" icon={Calendar}>
          <div className="space-y-2.5 mt-1">
            {CONTRATOS_VENCENDO.map((c) => (
              <div key={c.numero} className="flex items-center justify-between p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg">
                <div className="min-w-0">
                  <p className="text-xs font-mono font-bold text-amber-700">{c.numero}</p>
                  <p className="text-xs text-gray-700 truncate">{c.cliente}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs font-semibold text-gray-900">{formatCurrency(c.valor)}</p>
                  <p className="text-[10px] text-amber-600">{new Date(c.vencimento).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      );

    case "list-inadimplentes":
      return (
        <ChartCard title="Inadimplentes" icon={AlertTriangle}>
          <div className="space-y-2.5 mt-1">
            {INADIMPLENTES.map((i) => (
              <div key={i.contrato} className="flex items-center justify-between p-2.5 bg-red-50/50 border border-red-100 rounded-lg">
                <div className="min-w-0">
                  <p className="text-xs font-mono font-bold text-red-700">{i.contrato}</p>
                  <p className="text-xs text-gray-700 truncate">{i.cliente}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs font-semibold text-red-700">{formatCurrency(i.valor)}</p>
                  <p className="text-[10px] text-red-500">{i.dias} dias</p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      );

    case "list-alertas":
      return (
        <ChartCard title="Alertas e Notificações" icon={Activity}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
            {[
              { title: "Divergência repasse", desc: "Contrato MV-2026-0024: repasse 4% menor que calculado.", icon: AlertTriangle, color: "text-red-600 bg-red-50 border-red-100" },
              { title: "NF pendente", desc: "Fernanda Oliveira precisa enviar NF até amanhã.", icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-100" },
              { title: "Conformidade OK", desc: "Lucas Rodrigues: 100% de conformidade nas NFs.", icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-100" },
            ].map((n, i) => (
              <div key={i} className={cn("p-3 rounded-lg border flex gap-2.5", n.color)}>
                <n.icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{n.title}</p>
                  <p className="text-[11px] opacity-75 mt-0.5">{n.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      );

    default:
      return null;
  }
}

// ─── KPI Card ─────────────────────────────────────

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp,
  color = "blue",
  highlight = false,
  progress,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  color?: "blue" | "emerald" | "amber" | "rose" | "purple" | "indigo";
  highlight?: boolean;
  progress?: number;
}) {
  const colorClasses = {
    blue: "text-blue-600 bg-blue-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    rose: "text-rose-600 bg-rose-50",
    purple: "text-purple-600 bg-purple-50",
    indigo: "text-indigo-600 bg-indigo-50",
  };

  return (
    <div
      className={cn(
        "h-full p-5 rounded-xl border transition-colors",
        highlight ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-900 border-gray-200"
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <div className={cn("p-2 rounded-lg", highlight ? "bg-white/10" : colorClasses[color])}>
          <Icon className={cn("h-4 w-4", highlight ? "text-blue-400" : "")} />
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1 text-xs font-medium", trendUp ? "text-green-500" : "text-red-400")}>
            {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend}
          </div>
        )}
      </div>
      <p className={cn("text-xs mb-1", highlight ? "text-gray-400" : "text-gray-500")}>{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && (
        <p className={cn("text-[11px] mt-1", highlight ? "text-gray-400" : "text-gray-400")}>{subtitle}</p>
      )}
      {progress !== undefined && (
        <div className={cn("w-full h-1.5 rounded-full overflow-hidden mt-3", highlight ? "bg-white/10" : "bg-gray-100")}>
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              progress >= 100 ? "bg-green-500" : progress >= 70 ? "bg-blue-500" : "bg-amber-500"
            )}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Chart/List Card ──────────────────────────────

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-gray-400" />}
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
            {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
