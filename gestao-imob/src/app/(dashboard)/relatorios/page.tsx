"use client";

import { BarChart3, Database, FileClock, Lock, ReceiptText } from "lucide-react";
import { EmptyState, PageShell, Stat } from "@/components/shared/page-shell";

const REPORTS = [
  "Financeiro mensal",
  "Inadimplencia",
  "Fechamento de comissoes",
  "Contratos e ocupacao",
  "DIMOB",
];

export default function RelatoriosPage() {
  return (
    <PageShell
      title="Relatorios"
      description="Central preparada para relatorios reais. Exportacoes demonstrativas foram desativadas."
      icon={BarChart3}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Relatorios demonstrativos" value="0" color="emerald" />
        <Stat label="Relatorios pendentes de banco" value={REPORTS.length} color="amber" />
        <Stat label="Exportacao real ativa" value="NFS-e" color="blue" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Fila de relatorios reais</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {REPORTS.map((report) => (
            <div key={report} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <ReceiptText className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{report}</p>
                  <p className="text-xs text-gray-500">Disponivel quando o banco real estiver conectado.</p>
                </div>
              </div>
              <Lock className="h-4 w-4 text-gray-400" />
            </div>
          ))}
        </div>
      </div>

      <EmptyState
        icon={FileClock}
        title="Sem CSV falso"
        description="A tela nao gera mais arquivos baseados em mock. O primeiro relatorio real continua sendo o relatorio mensal de NFS-e dentro da tela de Notas Fiscais."
      />
    </PageShell>
  );
}
