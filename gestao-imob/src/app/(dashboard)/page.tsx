"use client";

import Link from "next/link";
import { BarChart3, Database, FileText, Receipt, ShieldCheck, TrendingUp } from "lucide-react";
import { EmptyState, PageShell, Stat } from "@/components/shared/page-shell";

const DATA_SOURCES = [
  { label: "Notas fiscais", status: "Operacional local", href: "/notas-fiscais" },
  { label: "Banco financeiro", status: "Aguardando banco real", href: "/financeiro" },
  { label: "Contratos e pessoas", status: "Aguardando banco real", href: "/contratos" },
  { label: "Comissoes e folha", status: "Aguardando consolidacao real", href: "/comissoes" },
];

export default function DashboardPage() {
  return (
    <PageShell
      title="Painel"
      description="Visao executiva preparada para dados reais. Indicadores demonstrativos foram removidos."
      icon={TrendingUp}
      actions={
        <Link
          href="/release-atual"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ShieldCheck className="h-4 w-4" />
          Release atual
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Fontes com dados reais" value="1/4" color="blue" />
        <Stat label="Dados demonstrativos ativos" value="0" color="emerald" />
        <Stat label="Dependencia critica" value="Banco real" color="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Fontes de dados do painel</h2>
          </div>
          <div className="space-y-2">
            {DATA_SOURCES.map((source) => (
              <Link
                key={source.label}
                href={source.href}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm hover:bg-gray-100"
              >
                <span className="font-medium text-gray-800">{source.label}</span>
                <span className="text-xs text-gray-500">{source.status}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Indicadores que voltam com banco real</h2>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
            {[
              "Receita, despesa, lucro e fluxo mensal",
              "Contratos vencendo e inadimplencia",
              "Comissoes pagas e pendentes",
              "Ranking operacional e alertas de risco",
            ].map((item) => (
              <div key={item} className="rounded-lg bg-gray-50 px-3 py-2">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <EmptyState
        icon={Receipt}
        title="Painel sem dados falsos"
        description="A area executiva nao exibe mais numeros simulados. Por enquanto, use Notas Fiscais para validar o fluxo real de importacao DW e emissao NFS-e."
        action={
          <Link
            href="/notas-fiscais"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <FileText className="h-4 w-4" />
            Ir para notas fiscais
          </Link>
        }
      />
    </PageShell>
  );
}
