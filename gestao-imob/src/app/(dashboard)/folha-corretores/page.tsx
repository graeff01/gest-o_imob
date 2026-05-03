"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Calculator, Loader2, RefreshCw, Settings2, Wallet } from "lucide-react";
import { PageShell, Stat } from "@/components/shared/page-shell";
import { cn, formatCurrency } from "@/lib/utils";

interface PayrollRow {
  employeeId: string;
  name: string;
  email: string;
  position: string;
  department: string;
  contractType: string;
  baseSalary: number;
  commission: number;
  benefits: number;
  deductions: number;
  gross: number;
  net: number;
  status: string;
  rentalCount: number;
  captureCount: number;
  openAdvances: number;
}

interface PayrollOverview {
  reference: { month: number; year: number; label: string };
  rows: PayrollRow[];
  summary: { employees: number; payrolls: number; gross: number; net: number; commissions: number; advances: number };
}

const statusStyles: Record<string, { label: string; color: string }> = {
  RASCUNHO: { label: "Rascunho", color: "bg-gray-50 text-gray-600 border-gray-200" },
  CALCULADO: { label: "Calculado", color: "bg-blue-50 text-blue-700 border-blue-200" },
  APROVADO: { label: "Aprovado", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PAGO: { label: "Pago", color: "bg-green-50 text-green-700 border-green-200" },
};

export default function FolhaPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [overview, setOverview] = useState<PayrollOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year) });
      const response = await fetch(`/api/payroll-overview?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar folha.");
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar folha real.");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  return (
    <PageShell
      title="Folha de Corretores"
      description="Folha real conectada a funcionarios, comissoes, adiantamentos e pagamentos."
      icon={Wallet}
      actions={
        <>
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
              <option key={item} value={item}>{String(item).padStart(2, "0")}</option>
            ))}
          </select>
          <input value={year} onChange={(event) => setYear(Number(event.target.value))} className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <button onClick={fetchPayroll} disabled={loading} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="Funcionarios ativos" value={loading ? "..." : overview?.summary.employees ?? 0} color="blue" />
        <Stat label="Folhas gravadas" value={loading ? "..." : overview?.summary.payrolls ?? 0} color="emerald" />
        <Stat label="Comissoes" value={loading ? "..." : formatCurrency(overview?.summary.commissions ?? 0)} color="amber" />
        <Stat label="Liquido previsto" value={loading ? "..." : formatCurrency(overview?.summary.net ?? 0)} color="blue" />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Nao foi possivel carregar a folha real.</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        A folha calcula a leitura atual a partir dos funcionarios cadastrados, comissoes do mes, adiantamentos em aberto e folhas ja gravadas no banco.
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando folha...
          </div>
        ) : !overview || overview.rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">Nenhum funcionario ativo encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Funcionario</th>
                  <th className="px-4 py-3 text-left">Cargo</th>
                  <th className="px-4 py-3 text-right">Fixo</th>
                  <th className="px-4 py-3 text-right">Comissao</th>
                  <th className="px-4 py-3 text-right">Adiantamentos</th>
                  <th className="px-4 py-3 text-right">Liquido</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overview.rows.map((row) => {
                  const status = statusStyles[row.status] ?? statusStyles.RASCUNHO;
                  return (
                    <tr key={row.employeeId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{row.name}</p>
                        <p className="text-xs text-gray-500">{row.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <p>{row.position}</p>
                        <p className="text-xs text-gray-400">{row.department} · {row.contractType}</p>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.baseSalary)}</td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-emerald-700">{formatCurrency(row.commission)}</p>
                        <p className="text-xs text-gray-400">{row.rentalCount} loc. · {row.captureCount} cap.</p>
                      </td>
                      <td className="px-4 py-3 text-right text-amber-700">{formatCurrency(row.openAdvances)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.net)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", status.color)}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/comissoes" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Calculator className="h-4 w-4" />
          Ver comissoes
        </Link>
        <Link href="/pessoas" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Settings2 className="h-4 w-4" />
          Gerir funcionarios
        </Link>
      </div>
    </PageShell>
  );
}
