"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, ArrowRight, Zap } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

type Tab = "despesas" | "receitas";

// Dados demonstrativos — substituídos por dados reais quando o banco estiver conectado
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_EXPENSES: any[] = [
  { id: "exp-001", date: "2026-04-01", category: "Folha de Pagamentos", subcategory: "Salários locação", description: "Salário — Lucas Rodrigues (CLT)", supplier: null, department: "LOCACAO", amount: 5800, status: "PAGO", source: "manual" },
  { id: "exp-002", date: "2026-04-01", category: "Folha de Pagamentos", subcategory: "Salários venda", description: "Salário — Thiago Lima (CLT)", supplier: null, department: "VENDA", amount: 6200, status: "PAGO", source: "manual" },
  { id: "exp-003", date: "2026-04-01", category: "Folha de Pagamentos", subcategory: "Salários admin", description: "Salário — Ana Paula Müller (CLT)", supplier: null, department: "ADMIN", amount: 3800, status: "PAGO", source: "manual" },
  { id: "exp-004", date: "2026-04-01", category: "Royalties Franquia", subcategory: "Royalties mensais", description: "Royalties Auxiliadora Predial — Abril/2026", supplier: "Auxiliadora Predial Franquias Ltda", department: "AMBOS", amount: 4700, status: "PAGO", source: "manual" },
  { id: "exp-005", date: "2026-04-01", category: "Marketing", subcategory: "Marketing digital", description: "Impulsionamento Instagram + ZAP Imóveis — Abril", supplier: "Agência Digital RS", department: "AMBOS", amount: 2400, status: "PAGO", source: "manual" },
  { id: "exp-006", date: "2026-04-02", category: "Manutenção", subcategory: "Hidráulica", description: "Troca de torneira — Ap 301 Av. Independência", supplier: "João Encanador ME", department: "LOCACAO", amount: 380, status: "PAGO", source: "manual" },
  { id: "exp-007", date: "2026-04-03", category: "Contas de Consumo", subcategory: "Luz/Energia", description: "Conta de energia — CEEE Equatorial", supplier: "CEEE EQUATORIAL", department: "AMBOS", amount: 847, status: "PAGO", source: "ai" },
  { id: "exp-008", date: "2026-04-03", category: "Contas de Consumo", subcategory: "Telefone/Internet", description: "Plano escritório — internet fibra ótica", supplier: "Claro Empresas", department: "AMBOS", amount: 490, status: "PAGO", source: "manual" },
  { id: "exp-009", date: "2026-03-28", category: "Impostos e Tributos", subcategory: "ISSQN", description: "ISSQN março/2026", supplier: "Prefeitura Municipal de Porto Alegre", department: "AMBOS", amount: 2340, status: "PAGO", source: "manual" },
  { id: "exp-010", date: "2026-04-10", category: "Impostos e Tributos", subcategory: "CSLL", description: "CSLL — 1° trimestre 2026", supplier: "Receita Federal", department: "AMBOS", amount: 3120, status: "PENDENTE", source: "manual" },
  { id: "exp-011", date: "2026-04-05", category: "Material de Escritório", subcategory: "Papelaria", description: "Compra de suprimentos — Zaffari", supplier: "ZAFFARI COMERCIO E INDUSTRIA", department: "AMBOS", amount: 287, status: "PAGO", source: "ai" },
  { id: "exp-012", date: "2026-04-08", category: "Software/Sistemas", subcategory: "CRM imobiliário", description: "Licença mensal — PipeImob", supplier: "PipeImob Tecnologia", department: "AMBOS", amount: 490, status: "PAGO", source: "manual" },
  { id: "exp-013", date: "2026-03-20", category: "Manutenção", subcategory: "Pintura", description: "Pintura fachada — R. Padre Chagas 302", supplier: "Pintura Pro Ltda", department: "LOCACAO", amount: 4500, status: "PENDENTE", source: "manual" },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_REVENUES: any[] = [
  { id: "rev-001", date: "2026-04-01", category: "AGENCIAMENTO", description: "Taxa de administração — Av. Goethe 77, Cobertura", contract: "MV-2026-0004", department: "LOCACAO", amount: 1000, source: "manual" },
  { id: "rev-002", date: "2026-04-01", category: "AGENCIAMENTO", description: "Taxa de administração — Av. Independência 1200", contract: "MV-2026-0001", department: "LOCACAO", amount: 400, source: "manual" },
  { id: "rev-003", date: "2026-04-01", category: "AGENCIAMENTO", description: "Taxa de administração — R. Padre Chagas 302", contract: "MV-2026-0002", department: "LOCACAO", amount: 600, source: "manual" },
  { id: "rev-004", date: "2026-04-01", category: "AGENCIAMENTO", description: "Taxa de administração — Av. Protásio Alves 3000", contract: "MV-2026-0007", department: "LOCACAO", amount: 420, source: "manual" },
  { id: "rev-005", date: "2026-03-20", category: "INTERMEDIACAO", description: "Comissão intermediação — MV-2026-0002", contract: "MV-2026-0002", department: "LOCACAO", amount: 8400, source: "manual" },
  { id: "rev-006", date: "2026-03-15", category: "INTERMEDIACAO", description: "Comissão intermediação — MV-2026-0004", contract: "MV-2026-0004", department: "LOCACAO", amount: 17000, source: "manual" },
  { id: "rev-007", date: "2026-02-28", category: "NFSE_ALUGUEL", description: "NFSe emitida ref. fevereiro — MV-2026-0004", contract: "MV-2026-0004", department: "LOCACAO", amount: 4440, source: "manual" },
  { id: "rev-008", date: "2026-04-05", category: "OUTRO", description: "PIX recebido — Aluguel Ap 301 Av. Independência", contract: "MV-2026-0001", department: "LOCACAO", amount: 4000, source: "ai" },
  { id: "rev-009", date: "2026-02-10", category: "INTERMEDIACAO", description: "Comissão venda — Lote 15 Av. Nilo Peçanha", contract: "MV-2026-0009", department: "VENDA", amount: 51000, source: "manual" },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDENTE: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  PAGO: { label: "Pago", color: "bg-green-100 text-green-700" },
  VENCIDO: { label: "Vencido", color: "bg-red-100 text-red-600" },
  CANCELADO: { label: "Cancelado", color: "bg-gray-100 text-gray-500" },
};

const catLabels: Record<string, string> = {
  INTERMEDIACAO: "Intermediação",
  AGENCIAMENTO: "Agenciamento",
  NFSE_ALUGUEL: "NFSe Aluguel",
  CAMPANHA_SUCESSO: "Camp. Sucesso",
  OUTRO: "Outro",
};

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function FinanceiroPage() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<Tab>("despesas");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const totalExpenses = MOCK_EXPENSES.reduce((s, e) => s + e.amount, 0);
  const totalRevenues = MOCK_REVENUES.reduce((s, r) => s + r.amount, 0);
  const aiExpenses = MOCK_EXPENSES.filter((e) => e.source === "ai");
  const aiRevenues = MOCK_REVENUES.filter((r) => r.source === "ai");
  const paidExpenses = MOCK_EXPENSES.filter((e) => e.status === "PAGO").reduce((s, e) => s + e.amount, 0);
  const pendingExpenses = MOCK_EXPENSES.filter((e) => e.status === "PENDENTE").reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Despesas</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
          <div className="flex gap-2 mt-2 text-[10px]">
            <span className="text-green-600">Pago: {formatCurrency(paidExpenses)}</span>
            <span className="text-yellow-600">Pend: {formatCurrency(pendingExpenses)}</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Receitas</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalRevenues)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Resultado</p>
          <p className={cn("text-xl font-bold", totalRevenues - totalExpenses >= 0 ? "text-blue-600" : "text-red-600")}>
            {formatCurrency(totalRevenues - totalExpenses)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-[40px]" />
          <p className="text-xs text-blue-600 mb-1 flex items-center gap-1 font-medium relative">
            <Zap className="h-3 w-3" /> Lançados via IA
          </p>
          <p className="text-xl font-bold text-blue-700 relative">{aiExpenses.length + aiRevenues.length}</p>
          <Link href="/documentos" className="text-[10px] text-blue-500 flex items-center gap-0.5 mt-1 hover:underline relative">
            Escanear documento <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setActiveTab("despesas"); }}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "despesas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <TrendingDown className="h-4 w-4" />Despesas
          </button>
          <button
            onClick={() => { setActiveTab("receitas"); }}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "receitas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <TrendingUp className="h-4 w-4" />Receitas
          </button>
        </div>

        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <div className="ml-auto">
          <Link
            href="/documentos"
            className="flex items-center gap-2 px-3 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
          >
            <Zap className="h-4 w-4" />
            Lançar via Central IA
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === "despesas" ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Descrição</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fornecedor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Depto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_EXPENSES.map((exp) => {
                  const st = statusLabels[exp.status] || { label: exp.status, color: "" };
                  return (
                    <tr key={exp.id} className={cn("hover:bg-gray-50", exp.source === "ai" && "bg-blue-50/30")}>
                      <td className="px-4 py-3 text-gray-600">{formatDate(exp.date)}</td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-gray-700 text-xs font-medium">{exp.category}</span>
                          {exp.subcategory && <p className="text-[10px] text-gray-400">{exp.subcategory}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-1.5">
                          {exp.source === "ai" && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded uppercase">IA</span>
                          )}
                          {exp.description}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{exp.supplier || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{exp.department}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">{formatCurrency(exp.amount)}</td>
                      <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", st.color)}>{st.label}</span></td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={5} className="px-4 py-3 font-medium text-gray-700 text-sm">Total de Despesas</td>
                  <td className="px-4 py-3 text-right font-bold text-red-700 text-base">{formatCurrency(totalExpenses)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Descrição</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Contrato</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Depto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_REVENUES.map((rev) => (
                  <tr key={rev.id} className={cn("hover:bg-gray-50", rev.source === "ai" && "bg-blue-50/30")}>
                    <td className="px-4 py-3 text-gray-600">{formatDate(rev.date)}</td>
                    <td className="px-4 py-3 text-gray-600">{catLabels[rev.category] || rev.category}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-1.5">
                        {rev.source === "ai" && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded uppercase">IA</span>
                        )}
                        {rev.description}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{rev.contract || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{rev.department}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">{formatCurrency(rev.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={5} className="px-4 py-3 font-medium text-gray-700 text-sm">Total de Receitas</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700 text-base">{formatCurrency(totalRevenues)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
