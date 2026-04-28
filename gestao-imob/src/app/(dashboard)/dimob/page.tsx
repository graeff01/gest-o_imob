"use client";

import { Database, FileOutput, Lock, ShieldAlert } from "lucide-react";
import { EmptyState, PageShell, Stat } from "@/components/shared/page-shell";

const REQUIREMENTS = [
  "Contratos de locacao do ano-base",
  "Locatarios com CPF/CNPJ valido",
  "Proprietarios com CPF/CNPJ valido",
  "Imoveis vinculados aos contratos",
  "Valores pagos no periodo declaravel",
];

export default function DimobPage() {
  return (
    <PageShell
      title="DIMOB"
      description="Declaracao anual preparada para dados reais. Geracao mock foi removida."
      icon={FileOutput}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Registros demonstrativos" value="0" color="emerald" />
        <Stat label="Fonte obrigatoria" value="Banco real" color="amber" />
        <Stat label="Status da geracao" value="Bloqueada" color="rose" />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Geracao bloqueada ate existir base real</p>
            <p className="mt-1 text-sm text-amber-800">
              DIMOB e declaracao fiscal. Manter arquivo simulado aqui cria risco operacional. A tela fica
              preparada, mas so gera arquivo quando contratos, pessoas e valores vierem do banco real.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Dados exigidos para liberar DIMOB</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {REQUIREMENTS.map((item) => (
            <div key={item} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
              <span className="text-sm font-medium text-gray-800">{item}</span>
              <Lock className="h-4 w-4 text-gray-400" />
            </div>
          ))}
        </div>
      </div>

      <EmptyState
        icon={FileOutput}
        title="DIMOB sem mock"
        description="O proximo passo desta frente sera conectar a geracao ao banco real e validar o arquivo no programa oficial da Receita Federal."
      />
    </PageShell>
  );
}
