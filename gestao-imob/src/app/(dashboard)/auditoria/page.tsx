"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  Search,
  User,
  Sparkles,
  Cpu,
  Filter,
  Download,
} from "lucide-react";
import { PageShell, EmptyState, Stat } from "@/components/shared/page-shell";
import { cn } from "@/lib/utils";
import {
  AuditEntry,
  AuditAction,
  getAuditLog,
} from "@/lib/stores/core-store";

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "Criação",
  UPDATE: "Atualização",
  DELETE: "Remoção",
  APPROVE: "Aprovação",
  REJECT: "Rejeição",
  AI_CLASSIFY: "Classificação IA",
  AI_AUTO_APPROVE: "Auto-aprovação IA",
  LOGIN: "Login",
  EXPORT: "Exportação",
  CONFIG_CHANGE: "Alteração de config",
  IMPORT: "Importação",
};

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE: "bg-emerald-50 text-emerald-700",
  UPDATE: "bg-blue-50 text-blue-700",
  DELETE: "bg-red-50 text-red-700",
  APPROVE: "bg-emerald-50 text-emerald-700",
  REJECT: "bg-amber-50 text-amber-700",
  AI_CLASSIFY: "bg-indigo-50 text-indigo-700",
  AI_AUTO_APPROVE: "bg-purple-50 text-purple-700",
  LOGIN: "bg-gray-50 text-gray-600",
  EXPORT: "bg-gray-50 text-gray-600",
  CONFIG_CHANGE: "bg-amber-50 text-amber-700",
  IMPORT: "bg-blue-50 text-blue-700",
};

export default function AuditoriaPage() {
  const [log, setLog] = useState<AuditEntry[]>([]);
  const [query, setQuery] = useState("");
  const [actorFilter, setActorFilter] = useState<"ALL" | "HUMAN" | "AI" | "SYSTEM">("ALL");
  const [actionFilter, setActionFilter] = useState<AuditAction | "ALL">("ALL");

  useEffect(() => {
    setLog(getAuditLog());
  }, []);

  const filtered = useMemo(() => {
    return log.filter((e) => {
      if (actorFilter !== "ALL" && e.actorType !== actorFilter) return false;
      if (actionFilter !== "ALL" && e.action !== actionFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          e.summary.toLowerCase().includes(q) ||
          e.entityType.toLowerCase().includes(q) ||
          (e.entityLabel?.toLowerCase().includes(q) ?? false) ||
          e.actor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [log, query, actorFilter, actionFilter]);

  const totalIA = log.filter((e) => e.actorType === "AI").length;
  const totalHumano = log.filter((e) => e.actorType === "HUMAN").length;

  const exportCSV = () => {
    const header = "Data,Ator,Tipo,Ação,Entidade,Item,Resumo,Confiança";
    const rows = filtered.map((e) =>
      [
        e.timestamp,
        e.actor,
        e.actorType,
        e.action,
        e.entityType,
        e.entityLabel || "",
        `"${e.summary.replace(/"/g, '""')}"`,
        e.confidence ?? "",
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
      description="Trilha imutável de todas as ações do sistema — humanos e IA"
      icon={Shield}
      actions={
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total de eventos" value={log.length} />
        <Stat label="Ações humanas" value={totalHumano} color="blue" />
        <Stat label="Ações da IA" value={totalIA} color="emerald" />
        <Stat
          label="% automatizado"
          value={log.length > 0 ? `${Math.round((totalIA / log.length) * 100)}%` : "—"}
          color="amber"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value as typeof actorFilter)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="ALL">Todos os atores</option>
            <option value="HUMAN">Apenas humanos</option>
            <option value="AI">Apenas IA</option>
            <option value="SYSTEM">Apenas sistema</option>
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as AuditAction | "ALL")}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="ALL">Todas as ações</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Nenhum evento registrado"
          description="O log de auditoria registra automaticamente toda ação do sistema. Crie ou edite registros para começar a popular a trilha."
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Data/Hora</th>
                <th className="px-4 py-3 text-left">Ator</th>
                <th className="px-4 py-3 text-left">Ação</th>
                <th className="px-4 py-3 text-left">Entidade</th>
                <th className="px-4 py-3 text-left">Resumo</th>
                <th className="px-4 py-3 text-center">Confiança</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0, 200).map((e) => {
                const ActorIcon =
                  e.actorType === "AI" ? Sparkles : e.actorType === "SYSTEM" ? Cpu : User;
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-600 font-mono whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <ActorIcon
                          className={cn(
                            "h-3.5 w-3.5",
                            e.actorType === "AI"
                              ? "text-indigo-600"
                              : e.actorType === "SYSTEM"
                              ? "text-gray-500"
                              : "text-blue-600"
                          )}
                        />
                        <span className="text-xs text-gray-700">{e.actor}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          ACTION_COLORS[e.action]
                        )}
                      >
                        {ACTION_LABELS[e.action]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-medium text-gray-900">{e.entityType}</p>
                      {e.entityLabel && (
                        <p className="text-gray-400 truncate max-w-[160px]">{e.entityLabel}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{e.summary}</td>
                    <td className="px-4 py-3 text-center">
                      {e.confidence !== undefined ? (
                        <span
                          className={cn(
                            "text-[11px] font-semibold",
                            e.confidence >= 95
                              ? "text-green-600"
                              : e.confidence >= 80
                              ? "text-blue-600"
                              : "text-amber-600"
                          )}
                        >
                          {e.confidence}%
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <div className="p-3 text-center text-[11px] text-gray-400 border-t border-gray-100">
              Mostrando 200 de {filtered.length} eventos. Use filtros para refinar.
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
