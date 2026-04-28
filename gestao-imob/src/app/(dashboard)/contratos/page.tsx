"use client";

import Link from "next/link";
import { Database, FileClock, FileText, Lock, Users } from "lucide-react";
import { EmptyState, PageShell, Stat } from "@/components/shared/page-shell";

const REQUIREMENTS = [
  "Cliente ou locatario cadastrado",
  "Proprietario cadastrado",
  "Imovel vinculado ao proprietario",
  "Valor, vigencia e status do contrato",
  "Responsavel operacional",
];

export default function ContratosPage() {
  return (
    <PageShell
      title="Contratos"
      description="Modulo preparado para contratos reais. Lista demonstrativa removida."
      icon={FileText}
      actions={
        <Link
          href="/pessoas"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Users className="h-4 w-4" />
          Ver pessoas
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Contratos demonstrativos" value="0" color="emerald" />
        <Stat label="Fonte obrigatoria" value="Banco real" color="amber" />
        <Stat label="Cadastro manual" value="Bloqueado" color="rose" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Dados necessarios para liberar contratos</h2>
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
        icon={FileClock}
        title="Contratos sem dados falsos"
        description="A antiga listagem era demonstrativa. O fluxo real deve ser conectado ao banco antes de aparecer para cliente como operacao ativa."
      />
    </PageShell>
  );
}
