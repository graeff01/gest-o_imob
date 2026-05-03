"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Cpu, Download, Filter, Loader2, RefreshCw, Search, Shield, User } from "lucide-react";
import { EmptyState, PageShell, Stat } from "@/components/shared/page-shell";
import { cn } from "@/lib/utils";

interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorType: "HUMAN" | "AUTOMATION" | "SYSTEM";
  action: string;
  entityType: string;
  entityLabel: string;
  summary: string;
  severity: "INFO" | "WARN" | "CRITICAL";
}

interface AuditOverview {
  events: AuditEvent[];
  summary: { total: number; automation: number; critical: number; warnings: number };
}

const actionLabels: Record<string, string> = {
  NFS_CREATED: "Nota criada",
  NFS_STATUS: "Status NFS-e",
  EMISSION_ERROR: "Erro de emissao",
  DOCUMENT_PROCESSING: "Documento",
  DOCUMENT_ERROR: "Erro documento",
  BANK_IMPORTED: "Extrato importado",
  BANK_RECONCILED: "Conciliado",
  BANK_REVIEW: "Revisao bancaria",
  WEBHOOK_RECEIVED: "Webhook recebido",
  WEBHOOK_PROCESSED: "Webhook processado",
};

const severityStyles = {
  INFO: "bg-blue-50 text-blue-700",
  WARN: "bg-amber-50 text-amber-700",
  CRITICAL: "bg-red-50 text-red-700",
};

export default function AuditoriaPage() {
  const [overview, setOverview] = useState<AuditOverview | null>(null);
  const [query, setQuery] = useState("");
  const [actorFilter, setActorFilter] = useState<"ALL" | "HUMAN" | "AUTOMATION" | "SYSTEM">("ALL");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "INFO" | "WARN" | "CRITICAL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAudit() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/audit-overview", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar auditoria.");
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar auditoria real.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAudit();
  }, []);

  const filtered = useMemo(() => {
    const events = overview?.events ?? [];
    return events.filter((event) => {
      if (actorFilter !== "ALL" && event.actorType !== actorFilter) return false;
      if (severityFilter !== "ALL" && event.severity !== severityFilter) return false;
      if (!query.trim()) return true;
      const text = `${event.actor} ${event.action} ${event.entityType} ${event.entityLabel} ${event.summary}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });
  }, [overview, query, actorFilter, severityFilter]);

  const exportCSV = () => {
    const header = "Data,Ator,Tipo,Acao,Entidade,Item,Severidade,Resumo";
    const rows = filtered.map((event) =>
      [
        event.timestamp,
        event.actor,
        event.actorType,
        event.action,
        event.entityType,
        event.entityLabel,
        event.severity,
        `"${event.summary.replace(/"/g, '""')}"`,
      ].join(",")
    );
    const csv = "\uFEFF" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell
      title="Log de Auditoria"
      description="Trilha operacional real gerada por notas, documentos, extratos e webhooks."
      icon={Shield}
      actions={
        <>
          <button onClick={fetchAudit} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total de eventos" value={loading ? "..." : overview?.summary.total ?? 0} />
        <Stat label="Automacoes" value={loading ? "..." : overview?.summary.automation ?? 0} color="emerald" />
        <Stat label="Alertas" value={loading ? "..." : overview?.summary.warnings ?? 0} color="amber" />
        <Stat label="Criticos" value={loading ? "..." : overview?.summary.critical ?? 0} color="rose" />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Nao foi possivel carregar auditoria real.</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm" />
          </div>
          <select value={actorFilter} onChange={(event) => setActorFilter(event.target.value as typeof actorFilter)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="ALL">Todos os atores</option>
            <option value="HUMAN">Humanos</option>
            <option value="AUTOMATION">Automacoes</option>
            <option value="SYSTEM">Sistema</option>
          </select>
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="ALL">Todas severidades</option>
            <option value="INFO">Info</option>
            <option value="WARN">Alerta</option>
            <option value="CRITICAL">Critico</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando auditoria...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Shield} title="Nenhum evento registrado" description="Eventos reais passam a aparecer conforme notas, extratos, documentos e webhooks forem processados." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Data/Hora</th>
                <th className="px-4 py-3 text-left">Ator</th>
                <th className="px-4 py-3 text-left">Acao</th>
                <th className="px-4 py-3 text-left">Entidade</th>
                <th className="px-4 py-3 text-left">Resumo</th>
                <th className="px-4 py-3 text-center">Severidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0, 200).map((event) => {
                const ActorIcon = event.actorType === "HUMAN" ? User : Cpu;
                return (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600">{new Date(event.timestamp).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <ActorIcon className={cn("h-3.5 w-3.5", event.actorType === "SYSTEM" ? "text-gray-500" : "text-blue-600")} />
                        <span className="text-xs text-gray-700">{event.actor}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">{actionLabels[event.action] ?? event.action}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-800">{event.entityType}</p>
                      <p className="max-w-[220px] truncate text-[11px] text-gray-500">{event.entityLabel}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{event.summary}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", severityStyles[event.severity])}>
                        {event.severity}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
