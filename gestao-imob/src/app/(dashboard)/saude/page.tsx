"use client";

import { useEffect, useState } from "react";
import {
  HeartPulse,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Database,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import { PageShell } from "@/components/shared/page-shell";
import { cn } from "@/lib/utils";
import {
  getFornecedores,
  getProprietarios,
  getExceptions,
  getParametrosVigentes,
} from "@/lib/stores/core-store";

interface HealthCheck {
  id: string;
  category: "Cadastro" | "Financeiro" | "Automação" | "Configuração";
  title: string;
  description: string;
  status: "OK" | "WARN" | "FAIL";
  details?: string;
}

interface SystemHealth {
  generatedAt: string;
  environment: {
    appEnv: string;
    gatewayMode: string;
    mockFallbacks: string;
    isProduction: boolean;
  };
  score: number;
  summary: {
    ok: number;
    warn: number;
    fail: number;
  };
  checks: Array<{
    id: string;
    label: string;
    status: "OK" | "WARN" | "FAIL";
    detail: string;
  }>;
  database: {
    connected: boolean;
    usersActive?: number;
    invoicesTotal?: number;
    invoicesPending?: number;
    error?: string;
  };
}

interface ManualReadinessItem {
  id: string;
  title: string;
  description: string;
}

interface HmlFixtureSnapshot {
  ready: boolean;
  checks: Array<{
    id: string;
    label: string;
    count: number;
    minimum: number;
    ok: boolean;
  }>;
}

const MANUAL_READINESS: ManualReadinessItem[] = [
  {
    id: "login-admin",
    title: "Login Admin Master validado",
    description: "Entrar com o perfil tecnico e confirmar acesso a Saude, Auditoria e Configuracoes.",
  },
  {
    id: "login-donos",
    title: "Logins dos dois Donos validados",
    description: "Entrar com cada dono e confirmar que telas tecnicas continuam bloqueadas.",
  },
  {
    id: "dw-real",
    title: "Arquivo DW real importado e reimportado",
    description: "Validar preview, confirmacao e duplicatas usando o arquivo real do DW.",
  },
  {
    id: "nfse-ciclo",
    title: "Ciclo NFS-e validado em stub",
    description: "Emitir, marcar enviada, marcar paga e cancelar uma nota de teste.",
  },
  {
    id: "auditoria-operacional",
    title: "Auditoria conferida",
    description: "Conferir se eventos importantes aparecem de forma compreensivel.",
  },
];

function runChecks(): HealthCheck[] {
  const fornecedores = getFornecedores();
  const proprietarios = getProprietarios();
  const exceptions = getExceptions();
  const params = getParametrosVigentes();

  const checks: HealthCheck[] = [];

  // ─── Cadastro ───
  checks.push({
    id: "fornecedores-com-categoria",
    category: "Cadastro",
    title: "Fornecedores com categoria padrão",
    description: "Fornecedores sem categoria forçam o gestor a classificar manualmente toda despesa",
    status:
      fornecedores.length === 0
        ? "WARN"
        : fornecedores.filter((f) => f.categoriaPadrao).length / fornecedores.length >= 0.8
        ? "OK"
        : "WARN",
    details:
      fornecedores.length === 0
        ? "Nenhum fornecedor cadastrado ainda"
        : `${fornecedores.filter((f) => f.categoriaPadrao).length}/${fornecedores.length} com categoria definida`,
  });

  checks.push({
    id: "proprietarios-com-pix",
    category: "Cadastro",
    title: "Proprietários com PIX cadastrado",
    description: "Sem PIX, repasses precisam de TED manual",
    status:
      proprietarios.length === 0
        ? "WARN"
        : proprietarios.filter((p) => p.pix).length / proprietarios.length >= 0.9
        ? "OK"
        : "WARN",
    details:
      proprietarios.length === 0
        ? "Nenhum proprietário cadastrado"
        : `${proprietarios.filter((p) => p.pix).length}/${proprietarios.length} com PIX`,
  });

  checks.push({
    id: "proprietarios-com-contato",
    category: "Cadastro",
    title: "Proprietários com canal de contato",
    description: "Telefone ou email são essenciais para comunicação de repasses",
    status:
      proprietarios.length === 0
        ? "WARN"
        : proprietarios.every((p) => p.telefone || p.email)
        ? "OK"
        : "WARN",
    details: `${proprietarios.filter((p) => p.telefone || p.email).length}/${proprietarios.length} com contato`,
  });

  // ─── Financeiro / Exceções ───
  const criticas = exceptions.filter((e) => e.status === "OPEN" && e.severity === "CRITICAL").length;
  checks.push({
    id: "excecoes-criticas",
    category: "Financeiro",
    title: "Exceções críticas pendentes",
    description: "Divergências de repasse e duplicatas críticas precisam de revisão imediata",
    status: criticas === 0 ? "OK" : criticas <= 2 ? "WARN" : "FAIL",
    details: `${criticas} exceção(ões) crítica(s) na caixa de entrada`,
  });

  const totalOpen = exceptions.filter((e) => e.status === "OPEN").length;
  checks.push({
    id: "fila-saudavel",
    category: "Financeiro",
    title: "Fila de exceções controlada",
    description: "Fila acumulada indica que o gestor está atrasado na revisão",
    status: totalOpen <= 5 ? "OK" : totalOpen <= 15 ? "WARN" : "FAIL",
    details: `${totalOpen} pendência(s) total`,
  });

  // ─── Automação ───
  checks.push({
    id: "score-confianca",
    category: "Automação",
    title: "Threshold de auto-aprovação configurado",
    description: "Score mínimo para que uma classificação automática seja aprovada sem revisão humana",
    status: params.scoreConfiancaAutoAprovacao >= 90 ? "OK" : "WARN",
    details: `${params.scoreConfiancaAutoAprovacao}% — recomendado ≥ 90%`,
  });

  // ─── Configuração ───
  checks.push({
    id: "params-coerentes",
    category: "Configuração",
    title: "Tiers de comissão coerentes",
    description: "Tier 2 deve ter limite maior que Tier 1",
    status:
      params.consultorTier2Max > params.consultorTier1Max &&
      params.captadorTier2Max > params.captadorTier1Max
        ? "OK"
        : "FAIL",
    details: `Consultor: ${params.consultorTier1Max} → ${params.consultorTier2Max} | Captador: ${params.captadorTier1Max} → ${params.captadorTier2Max}`,
  });

  checks.push({
    id: "repasse-soma-100",
    category: "Configuração",
    title: "Splits de receita somam 100%",
    description: "Repasse matriz + receita agência = 100%",
    status:
      params.percentualRepasseMatriz + params.percentualReceitaAgencia === 100 ? "OK" : "FAIL",
    details: `${params.percentualRepasseMatriz}% + ${params.percentualReceitaAgencia}% = ${
      params.percentualRepasseMatriz + params.percentualReceitaAgencia
    }%`,
  });

  return checks;
}

const STATUS_STYLES = {
  OK: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
  WARN: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
  FAIL: { icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-100" },
} as const;

export default function SaudePage() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [systemHealthError, setSystemHealthError] = useState<string | null>(null);
  const [hmlFixture, setHmlFixture] = useState<HmlFixtureSnapshot | null>(null);
  const [hmlFixtureError, setHmlFixtureError] = useState<string | null>(null);
  const [hmlFixtureLoading, setHmlFixtureLoading] = useState(false);
  const [manualReady, setManualReady] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    setChecks(runChecks());
    setSystemHealthError(null);
    setHmlFixtureError(null);

    await Promise.all([
      fetch("/api/system/health", { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Falha ao checar saude tecnica.");
          setSystemHealth(data);
        })
        .catch((error) => {
          setSystemHealth(null);
          setSystemHealthError(error instanceof Error ? error.message : "Falha ao checar saude tecnica.");
        }),
      fetch("/api/system/hml-fixtures", { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Falha ao checar base HML.");
          setHmlFixture(data);
        })
        .catch((error) => {
          setHmlFixture(null);
          setHmlFixtureError(error instanceof Error ? error.message : "Falha ao checar base HML.");
        }),
    ]);
  };

  const runHmlFixtureAction = async (action: "seed" | "reset-and-seed") => {
    const resetConfirmed =
      action === "seed" ||
      window.confirm("Isso apaga dados operacionais de HML e recria a base de teste. Usuarios de login sao preservados. Continuar?");
    if (!resetConfirmed) return;

    setHmlFixtureLoading(true);
    setHmlFixtureError(null);
    try {
      const response = await fetch("/api/system/hml-fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao preparar HML.");
      setHmlFixture(data.snapshot);
      await refresh();
    } catch (error) {
      setHmlFixtureError(error instanceof Error ? error.message : "Falha ao preparar HML.");
    } finally {
      setHmlFixtureLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const total = checks.length;
  const ok = checks.filter((c) => c.status === "OK").length;
  const warn = checks.filter((c) => c.status === "WARN").length;
  const fail = checks.filter((c) => c.status === "FAIL").length;
  const score = total > 0 ? Math.round((ok / total) * 100) : 0;

  const grouped = checks.reduce<Record<string, HealthCheck[]>>((acc, c) => {
    (acc[c.category] = acc[c.category] || []).push(c);
    return acc;
  }, {});

  const manualDone = MANUAL_READINESS.filter((item) => manualReady[item.id]).length;
  const technicalReadyItems = systemHealth
    ? [
        {
          title: "Ambiente identificado",
          ok: Boolean(systemHealth.environment.appEnv),
          detail: systemHealth.environment.appEnv,
        },
        {
          title: "Fallbacks mock desligados",
          ok: systemHealth.environment.mockFallbacks === "disabled",
          detail: systemHealth.environment.mockFallbacks,
        },
        {
          title: "Gateway nao esta real por acidente",
          ok: systemHealth.environment.gatewayMode === "stub" || !systemHealth.environment.isProduction,
          detail: systemHealth.environment.gatewayMode,
        },
        {
          title: "Banco respondeu",
          ok: systemHealth.database.connected,
          detail: systemHealth.database.connected ? "conectado" : systemHealth.database.error ?? "falha",
        },
        {
          title: "Usuarios ativos esperados",
          ok: systemHealth.database.usersActive === 3,
          detail: `${systemHealth.database.usersActive ?? 0} ativo(s), esperado: 3`,
        },
      ]
    : [];

  return (
    <PageShell
      title="Saúde Operacional"
      description="Checagens automáticas que detectam problemas estruturais antes deles virarem dor"
      icon={HeartPulse}
      actions={
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Re-checar
        </button>
      }
    >
      {/* Diagnostico tecnico */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Diagnostico tecnico</h2>
            <p className="text-xs text-gray-500 mt-1">
              Visivel apenas para Admin Master. Donos nao acessam esta tela.
            </p>
          </div>
          {systemHealth && (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                systemHealth.summary.fail > 0
                  ? "bg-red-50 text-red-700"
                  : systemHealth.summary.warn > 0
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
              )}
            >
              {systemHealth.score}%
            </span>
          )}
        </div>

        {systemHealthError && (
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {systemHealthError}
          </div>
        )}

        {systemHealth && (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-semibold">Ambiente</p>
                <p className="mt-1 text-sm font-bold text-gray-900">{systemHealth.environment.appEnv}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-semibold">Gateway</p>
                <p className="mt-1 text-sm font-bold text-gray-900">{systemHealth.environment.gatewayMode}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-semibold">Mocks</p>
                <p className="mt-1 text-sm font-bold text-gray-900">{systemHealth.environment.mockFallbacks}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-semibold">Usuarios ativos</p>
                <p className="mt-1 text-sm font-bold text-gray-900">{systemHealth.database.usersActive ?? "-"}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-semibold">Notas pendentes</p>
                <p className="mt-1 text-sm font-bold text-gray-900">{systemHealth.database.invoicesPending ?? "-"}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {systemHealth.checks.map((item) => {
                const s = STATUS_STYLES[item.status];
                const Icon = s.icon;
                return (
                  <div key={item.id} className={cn("rounded-lg border px-3 py-2 flex gap-2", s.bg)}>
                    <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", s.color)} />
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{item.label}</p>
                      <p className="text-[11px] text-gray-600">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-2">
              <Database className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Base de validacao HML</h2>
              <p className="mt-1 text-xs text-gray-500">
                Prepara dados minimos para testar cadastros, contratos, financeiro, extratos, NFS-e, campanhas,
                comissoes, folha, relatorios e auditoria sem cadastro manual.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => runHmlFixtureAction("seed")}
              disabled={hmlFixtureLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Preparar base
            </button>
            <button
              onClick={() => runHmlFixtureAction("reset-and-seed")}
              disabled={hmlFixtureLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Resetar e preparar
            </button>
          </div>
        </div>

        {hmlFixtureError && (
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {hmlFixtureError}
          </div>
        )}

        {hmlFixture && (
          <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {hmlFixture.checks.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-lg border px-3 py-2",
                  item.ok ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50"
                )}
              >
                <p className="text-[10px] font-semibold uppercase text-gray-500">{item.label}</p>
                <p className="mt-1 text-sm font-bold text-gray-900">
                  {item.count}
                  {item.minimum > 0 && <span className="text-xs font-medium text-gray-500"> / min {item.minimum}</span>}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Checklist manual de PRD</h2>
              <p className="text-xs text-gray-500 mt-1">
                Itens que precisam ser validados por uma pessoa antes de liberar ambiente real.
              </p>
            </div>
            <span className="rounded-full bg-gray-50 border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700">
              {manualDone}/{MANUAL_READINESS.length}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {MANUAL_READINESS.map((item) => (
              <label
                key={item.id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3",
                  manualReady[item.id] ? "border-emerald-100 bg-emerald-50" : "border-gray-100 bg-gray-50"
                )}
              >
                <input
                  type="checkbox"
                  checked={Boolean(manualReady[item.id])}
                  onChange={(event) =>
                    setManualReady((current) => ({ ...current, [item.id]: event.target.checked }))
                  }
                  className="mt-0.5"
                />
                <div>
                  <p className="text-xs font-semibold text-gray-900">{item.title}</p>
                  <p className="text-[11px] text-gray-600">{item.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold text-gray-900">Revisao tecnica de seguranca</h2>
          <p className="text-xs text-gray-500 mt-1">
            Checagens objetivas para evitar liberar ambiente com configuracao perigosa.
          </p>
          <div className="mt-4 space-y-2">
            {technicalReadyItems.map((item) => (
              <div
                key={item.title}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2",
                  item.ok ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50"
                )}
              >
                {item.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold text-gray-900">{item.title}</p>
                  <p className="text-[11px] text-gray-600">{item.detail}</p>
                </div>
              </div>
            ))}
            {!systemHealth && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Carregue o diagnostico tecnico para ver a revisao de seguranca.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Score geral */}
      <div
        className={cn(
          "rounded-2xl border p-6 flex items-center gap-6",
          score >= 80
            ? "bg-emerald-50 border-emerald-100"
            : score >= 50
            ? "bg-amber-50 border-amber-100"
            : "bg-red-50 border-red-100"
        )}
      >
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 -rotate-90">
            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-white" />
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${(score / 100) * 251.3} 251.3`}
              className={
                score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600"
              }
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                "text-2xl font-bold",
                score >= 80 ? "text-emerald-700" : score >= 50 ? "text-amber-700" : "text-red-700"
              )}
            >
              {score}%
            </span>
          </div>
        </div>
        <div className="flex-1">
          <h2
            className={cn(
              "text-lg font-bold",
              score >= 80 ? "text-emerald-800" : score >= 50 ? "text-amber-800" : "text-red-800"
            )}
          >
            Sistema {score >= 80 ? "saudável" : score >= 50 ? "com atenção" : "crítico"}
          </h2>
          <p
            className={cn(
              "text-sm",
              score >= 80 ? "text-emerald-700" : score >= 50 ? "text-amber-700" : "text-red-700"
            )}
          >
            {ok} OK · {warn} atenção · {fail} crítico
          </p>
        </div>
      </div>

      {/* Checks por categoria */}
      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat} className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
            {cat}
          </h3>
          {list.map((c) => {
            const s = STATUS_STYLES[c.status];
            const Icon = s.icon;
            return (
              <div key={c.id} className={cn("border rounded-xl p-4 flex items-start gap-3", s.bg)}>
                <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", s.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{c.description}</p>
                  {c.details && <p className={cn("text-[11px] mt-1 font-medium", s.color)}>{c.details}</p>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </PageShell>
  );
}
