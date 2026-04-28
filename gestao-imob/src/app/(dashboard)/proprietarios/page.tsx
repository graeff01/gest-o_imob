"use client";

import Link from "next/link";
import { Database, UserSquare, Users } from "lucide-react";
import { EmptyState, PageShell, Stat } from "@/components/shared/page-shell";

export default function ProprietariosPage() {
  return (
    <PageShell
      title="Proprietarios"
      description="Modulo legado sem gravacao local. Use Pessoas para consultar dados reais da API."
      icon={UserSquare}
      actions={
        <Link
          href="/pessoas"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Users className="h-4 w-4" />
          Abrir Pessoas
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Cadastros locais legados" value="Desativado" color="emerald" />
        <Stat label="Fonte oficial" value="API / Banco" color="blue" />
        <Stat label="Mock visivel" value="0" color="emerald" />
      </div>

      <EmptyState
        icon={Database}
        title="Cadastro local removido"
        description="Esta tela nao salva mais dados em armazenamento local. Para evitar informacao falsa, proprietarios devem ser geridos pela tela Pessoas e persistidos no banco real."
      />
    </PageShell>
  );
}
