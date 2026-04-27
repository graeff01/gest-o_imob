"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Inbox,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  X,
  Eye,
  Sparkles,
} from "lucide-react";
import { PageShell, EmptyState, Stat } from "@/components/shared/page-shell";
import { cn } from "@/lib/utils";
import {
  ExceptionItem,
  ExceptionKind,
  ExceptionSeverity,
  ExceptionStatus,
  getExceptions,
  updateException,
  logAudit,
} from "@/lib/stores/core-store";

const KIND_LABELS: Record<ExceptionKind, string> = {
  AI_LOW_CONFIDENCE: "IA â€” baixa confianÃ§a",
  DUPLICATE: "Duplicata suspeita",
  DIVERGENCE: "DivergÃªncia",
  MISSING_LINK: "VÃ­nculo ausente",
  ANOMALY: "Anomalia",
  MANUAL_REVIEW: "RevisÃ£o manual",
};

const SEVERITY_STYLES: Record<ExceptionSeverity, { bg: string; text: string; icon: React.ElementType }> = {
  INFO: { bg: "bg-blue-50 border-blue-100", text: "text-blue-700", icon: Info },
  WARN: { bg: "bg-amber-50 border-amber-100", text: "text-amber-700", icon: AlertCircle },
  CRITICAL: { bg: "bg-red-50 border-red-100", text: "text-red-700", icon: AlertTriangle },
};

export default function CaixaEntradaPage() {
  const [items, setItems] = useState<ExceptionItem[]>([]);
  const [filter, setFilter] = useState<ExceptionStatus | "ALL">("OPEN");

  const refresh = () => setItems(getExceptions());

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(
    () => (filter === "ALL" ? items : items.filter((i) => i.status === filter)),
    [items, filter]
  );

  const counts = {
    open: items.filter((i) => i.status === "OPEN").length,
    critical: items.filter((i) => i.status === "OPEN" && i.severity === "CRITICAL").length,
    warn: items.filter((i) => i.status === "OPEN" && i.severity === "WARN").length,
    resolved: items.filter((i) => i.status === "RESOLVED").length,
  };

  const resolve = (id: string) => {
    const item = items.find((i) => i.id === id);
    updateException(id, {
      status: "RESOLVED",
      resolvedAt: new Date().toISOString(),
      resolvedBy: "Gestor",
    });
    if (item) {
      logAudit({
        actor: "Gestor",
        actorType: "HUMAN",
        action: "APPROVE",
        entityType: "ExceÃ§Ã£o",
        entityId: id,
        entityLabel: item.title,
        summary: `ExceÃ§Ã£o resolvida: ${item.title}`,
      });
    }
    refresh();
  };

  const dismiss = (id: string) => {
    const item = items.find((i) => i.id === id);
    updateException(id, {
      status: "DISMISSED",
      resolvedAt: new Date().toISOString(),
      resolvedBy: "Gestor",
    });
    if (item) {
      logAudit({
        actor: "Gestor",
        actorType: "HUMAN",
        action: "REJECT",
        entityType: "ExceÃ§Ã£o",
        entityId: id,
        entityLabel: item.title,
        summary: `ExceÃ§Ã£o descartada: ${item.title}`,
      });
    }
    refresh();
  };

  return (
    <PageShell
      title="Caixa de Entrada"
      description="Tudo que exige atenÃ§Ã£o humana â€” fila unificada de exceÃ§Ãµes e revisÃµes"
      icon={Inbox}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Pendentes" value={counts.open} color="amber" />
        <Stat label="CrÃ­ticas" value={counts.critical} color="rose" />
        <Stat label="AtenÃ§Ã£o" value={counts.warn} color="amber" />
        <Stat label="Resolvidas" value={counts.resolved} color="emerald" />
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700">
          <p className="font-medium mb-0.5">A "1 dia/mÃªs de revisÃ£o"</p>
          <p className="text-blue-600/80">
            Esta caixa concentra tudo que a IA nÃ£o conseguiu decidir sozinha: classificaÃ§Ãµes de baixa
            confianÃ§a, duplicatas suspeitas, divergÃªncias de repasse, vÃ­nculos ausentes e anomalias
            estatÃ­sticas. O gestor revisa, aprova ou descarta â€” e cada decisÃ£o alimenta o aprendizado
            da IA.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200">
        {(
          [
            { id: "OPEN", label: "Pendentes", count: counts.open },
            { id: "RESOLVED", label: "Resolvidas", count: counts.resolved },
            { id: "DISMISSED", label: "Descartadas", count: items.filter((i) => i.status === "DISMISSED").length },
            { id: "ALL", label: "Todas", count: items.length },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              filter === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {t.label}
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Caixa vazia"
          description="Quando a IA encontrar divergÃªncias, duplicatas ou classificaÃ§Ãµes de baixa confianÃ§a, elas aparecerÃ£o aqui."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const sev = SEVERITY_STYLES[item.severity];
            const Icon = sev.icon;
            return (
              <div
                key={item.id}
                className={cn("border rounded-xl p-4", sev.bg)}
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", sev.text)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className={cn("text-sm font-semibold", sev.text)}>{item.title}</h3>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/60 text-gray-700">
                        {KIND_LABELS[item.kind]}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {item.source} Â· {new Date(item.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700">{item.description}</p>
                    {item.meta && Object.keys(item.meta).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        {Object.entries(item.meta).map(([k, v]) => (
                          <span
                            key={k}
                            className="px-2 py-0.5 bg-white/70 border border-white rounded text-gray-600"
                          >
                            <span className="text-gray-400">{k}:</span> {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {item.status === "OPEN" && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => resolve(item.id)}
                        className="p-1.5 bg-white border border-green-200 rounded text-green-600 hover:bg-green-50"
                        title="Resolver"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => dismiss(item.id)}
                        className="p-1.5 bg-white border border-gray-200 rounded text-gray-500 hover:bg-gray-50"
                        title="Descartar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-1.5 bg-white border border-blue-200 rounded text-blue-600 hover:bg-blue-50"
                        title="Detalhes"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {item.status !== "OPEN" && (
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0",
                        item.status === "RESOLVED"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {item.status === "RESOLVED" ? "Resolvida" : "Descartada"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

// â”€â”€â”€ Seed inicial de exemplos representativos â”€â”€â”€â”€â”€
