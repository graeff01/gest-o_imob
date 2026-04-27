"use client";

import { CheckCircle2, CircleDashed, GitBranch, ShieldCheck } from "lucide-react";
import { PageShell, Stat } from "@/components/shared/page-shell";

const RELEASE = {
  version: "0.3.0-local",
  branch: "codex/sprint-api-auth-e-mocks",
  pr: "#3",
  sprint: "Blindagem pre-PRD local",
};

const CHECKLIST = [
  { label: "Login sem credenciais expostas na tela", done: true },
  { label: "CI com Prisma generate, typecheck, lint e build", done: true },
  { label: "Tela de NFS-e com historico visual e erro claro", done: true },
  { label: "Limpeza segura de importacoes DW pendentes", done: true },
  { label: "Dashboard, relatorios, comissoes e DIMOB sem mock visivel", done: true },
  { label: "Configuracao fiscal visivel apenas para Admin Master", done: true },
  { label: "Banco real Railway", done: false },
  { label: "Homologacao NFS.io", done: false },
  { label: "Deploy PRD", done: false },
];

export default function ReleaseAtualPage() {
  const done = CHECKLIST.filter((item) => item.done).length;

  return (
    <PageShell title="Release atual" description="Controle operacional da sprint em andamento." icon={GitBranch}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="Versao" value={RELEASE.version} color="blue" />
        <Stat label="Branch" value={RELEASE.branch} />
        <Stat label="PR" value={RELEASE.pr} color="amber" />
        <Stat label="Checklist" value={`${done}/${CHECKLIST.length}`} color="emerald" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">{RELEASE.sprint}</h2>
        </div>
        <div className="space-y-2">
          {CHECKLIST.map((item) => {
            const Icon = item.done ? CheckCircle2 : CircleDashed;
            return (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                <span className="text-sm font-medium text-gray-800">{item.label}</span>
                <Icon className={item.done ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-gray-400"} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        Status: esta sprint prepara o produto local para receber banco, Railway e NFS.io depois. Os itens de
        deploy e gateway ficam propositalmente pendentes ate existir ambiente HML.
      </div>
    </PageShell>
  );
}
