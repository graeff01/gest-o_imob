"use client";

import { useEffect, useState } from "react";
import {
  HeartPulse,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
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
  category: "Cadastro" | "Financeiro" | "IA" | "Configuração";
  title: string;
  description: string;
  status: "OK" | "WARN" | "FAIL";
  details?: string;
}

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

  // ─── IA ───
  checks.push({
    id: "score-confianca",
    category: "IA",
    title: "Threshold de auto-aprovação configurado",
    description: "Score mínimo para que a IA aprove sozinha sem revisão humana",
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

  const refresh = () => setChecks(runChecks());

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
