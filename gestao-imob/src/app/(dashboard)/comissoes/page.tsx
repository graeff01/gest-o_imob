"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calculator, Database, FileClock, Percent, Shield } from "lucide-react";
import { EmptyState, PageShell, Stat } from "@/components/shared/page-shell";
import { formatCurrency } from "@/lib/utils";

interface CommissionRule {
  id: string;
  rule_type: string;
  employee_type: string | null;
  min_threshold: number | null;
  max_threshold: number | null;
  percentage: string | null;
  fixed_amount: string | null;
  description: string | null;
}

interface CommissionOverview {
  commissions: { total: number; count: number; rules: number };
  contracts: { total: number; byStatus: Record<string, number>; intermediation: number };
  financial: { revenues: number };
}

const ruleTypeLabels: Record<string, string> = {
  CONSULTOR_INTERMEDIACAO: "Intermediacao - Consultor",
  CAPTADOR_INTERMEDIACAO: "Intermediacao - Captador",
  CAPTADOR_BONUS: "Bonus - Captador",
  VENDA: "Venda",
  CAMPANHA_SUCESSO: "Campanha Sucesso",
};

export default function ComissoesPage() {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [overview, setOverview] = useState<CommissionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/commissions/rules", { cache: "no-store" }),
      fetch("/api/financial-overview", { cache: "no-store" }),
    ])
      .then(async ([rulesResponse, overviewResponse]) => {
        const rulesData = await rulesResponse.json();
        const overviewData = await overviewResponse.json();
        if (!rulesResponse.ok) throw new Error(rulesData.error ?? "Falha ao carregar regras.");
        if (!overviewResponse.ok) throw new Error(overviewData.error ?? "Falha ao carregar consolidado.");
        setRules(rulesData.rules ?? []);
        setOverview(overviewData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar regras."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell
      title="Comissoes"
      description="Regras, contratos e fechamentos conectados ao consolidado real."
      icon={Percent}
      actions={
        <Link
          href="/folha-corretores"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Calculator className="h-4 w-4" />
          Folha de pagamento
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Regras reais cadastradas" value={loading ? "..." : rules.length} color="blue" />
        <Stat label="Fechamentos reais" value={loading ? "..." : overview?.commissions.count ?? 0} color="emerald" />
        <Stat label="Total de comissoes" value={loading ? "..." : formatCurrency(overview?.commissions.total ?? 0)} color="amber" />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Regras cadastradas no sistema</h2>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando regras...</p>
        ) : rules.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Regra</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Gatilho</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{ruleTypeLabels[rule.rule_type] ?? rule.rule_type}</p>
                      {rule.description && <p className="text-xs text-gray-500">{rule.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{rule.employee_type ?? "Todos"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {rule.min_threshold ?? 0}
                      {rule.max_threshold ? ` ate ${rule.max_threshold}` : "+"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {rule.percentage ? `${Number(rule.percentage).toFixed(2)}%` : formatCurrency(rule.fixed_amount ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Database}
            title="Nenhuma regra real cadastrada"
            description="Cadastre regras para que contratos e fechamentos reais possam calcular comissoes."
          />
        )}
      </div>

      <EmptyState
        icon={FileClock}
        title="Fechamento mensal sem registros no periodo"
        description={`Contratos ativos: ${overview?.contracts.byStatus.ATIVO ?? 0}. Intermediacao cadastrada: ${formatCurrency(overview?.contracts.intermediation ?? 0)}.`}
      />
    </PageShell>
  );
}
