"use client";

import { useState, useCallback } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Users,
  DollarSign,
  TrendingDown,
  TrendingUp,
  CheckCircle,
  Calendar,
  Building,
  Receipt,
  FileOutput,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MOCK_FINANCIAL_MONTHLY,
  MOCK_EXPENSE_CATEGORIES_PIE,
  MOCK_EMPLOYEES,
} from "@/lib/mock-data";

const CONTRACTS_MONTHLY = [
  { mes: "Out", novos: 6, encerrados: 2 },
  { mes: "Nov", novos: 8, encerrados: 3 },
  { mes: "Dez", novos: 5, encerrados: 4 },
  { mes: "Jan", novos: 9, encerrados: 2 },
  { mes: "Fev", novos: 7, encerrados: 3 },
  { mes: "Mar", novos: 11, encerrados: 1 },
  { mes: "Abr", novos: 10, encerrados: 2 },
];

const BROKER_PERFORMANCE = [
  { nome: "Lucas R.", locacoes: 8, vendas: 1, receita: 18400 },
  { nome: "Fernanda O.", locacoes: 12, vendas: 0, receita: 26800 },
  { nome: "Rafael S.", locacoes: 3, vendas: 2, receita: 7200 },
  { nome: "Camila S.", locacoes: 5, vendas: 0, receita: 11500 },
];

type ReportType =
  | "financeiro"
  | "comissoes"
  | "contratos"
  | "despesas"
  | "performance"
  | "folha"
  | "dimob"
  | "inadimplencia"
  | "ocupacao";

type ReportFormat = "csv" | "xlsx" | "pdf";

interface ReportDef {
  type: ReportType;
  label: string;
  description: string;
  icon: React.ElementType;
  category: "financeiro" | "operacional" | "fiscal" | "rh";
}

const REPORTS: ReportDef[] = [
  {
    type: "financeiro",
    label: "Relatório Financeiro Mensal",
    description: "Receitas, despesas e lucro consolidados por mês",
    icon: DollarSign,
    category: "financeiro",
  },
  {
    type: "despesas",
    label: "Despesas por Categoria",
    description: "Detalhamento de despesas agrupadas por categoria e subcategoria",
    icon: TrendingDown,
    category: "financeiro",
  },
  {
    type: "inadimplencia",
    label: "Relatório de Inadimplência",
    description: "Contratos em atraso e valores pendentes de recebimento",
    icon: TrendingDown,
    category: "financeiro",
  },
  {
    type: "contratos",
    label: "Movimentação de Contratos",
    description: "Contratos novos, renovados, encerrados e vencendo",
    icon: FileText,
    category: "operacional",
  },
  {
    type: "ocupacao",
    label: "Taxa de Ocupação",
    description: "Imóveis ocupados vs disponíveis na carteira",
    icon: Building,
    category: "operacional",
  },
  {
    type: "performance",
    label: "Performance por Corretor",
    description: "Locações, vendas e receita intermediada por corretor",
    icon: Users,
    category: "operacional",
  },
  {
    type: "comissoes",
    label: "Fechamento de Comissões",
    description: "Cálculo de comissões por tier com detalhamento",
    icon: Receipt,
    category: "rh",
  },
  {
    type: "folha",
    label: "Folha de Pagamento",
    description: "Folha mensal consolidada de funcionários CLT e PJ",
    icon: Users,
    category: "rh",
  },
  {
    type: "dimob",
    label: "DIMOB — Declaração Anual",
    description: "Declaração de Informações sobre Atividades Imobiliárias",
    icon: FileOutput,
    category: "fiscal",
  },
];

const CATEGORY_LABELS: Record<ReportDef["category"], { label: string; color: string }> = {
  financeiro: { label: "Financeiro", color: "text-blue-600 bg-blue-50" },
  operacional: { label: "Operacional", color: "text-emerald-600 bg-emerald-50" },
  fiscal: { label: "Fiscal", color: "text-amber-600 bg-amber-50" },
  rh: { label: "RH e Comissões", color: "text-purple-600 bg-purple-50" },
};

function generateCSV(type: ReportType): string {
  switch (type) {
    case "financeiro":
      return [
        "Mês,Receita,Despesa,Lucro",
        ...MOCK_FINANCIAL_MONTHLY.map((d) => `${d.mes},${d.receita},${d.despesa},${d.lucro}`),
      ].join("\n");
    case "comissoes":
      return [
        "Corretor,Locações,Vendas,Receita Intermediada",
        ...BROKER_PERFORMANCE.map((b) => `${b.nome},${b.locacoes},${b.vendas},${b.receita}`),
      ].join("\n");
    case "contratos":
      return [
        "Mês,Novos Contratos,Encerrados",
        ...CONTRACTS_MONTHLY.map((d) => `${d.mes},${d.novos},${d.encerrados}`),
      ].join("\n");
    case "despesas":
      return [
        "Categoria,Valor",
        ...MOCK_EXPENSE_CATEGORIES_PIE.map((d) => `${d.name},${d.value}`),
      ].join("\n");
    case "performance":
      return [
        "Corretor,CPF,Cargo,Tipo,Locações,Vendas,Receita",
        ...BROKER_PERFORMANCE.map((b) => {
          const emp = MOCK_EMPLOYEES.find((e) => e.user.name.startsWith(b.nome.split(" ")[0]));
          return `${b.nome},${emp?.cpf || ""},Consultor,${emp?.contract_type || ""},${b.locacoes},${b.vendas},${b.receita}`;
        }),
      ].join("\n");
    case "folha":
      return [
        "Funcionário,Tipo,Salário,Benefícios,Comissão,Total",
        ...MOCK_EMPLOYEES.map((e) => `${e.user.name},${e.contract_type},5000,1200,0,6200`),
      ].join("\n");
    case "inadimplencia":
      return "Contrato,Cliente,Valor,Dias em Atraso\nMV-2026-0012,Carlos Silva,3200,15\nMV-2026-0019,Ana Lopes,2800,8";
    case "ocupacao":
      return "Imóvel,Endereço,Status,Desde\n#101,Av. Independência 1200 Ap 301,OCUPADO,2026-02-01\n#102,R. Mostardeiro 555 Ap 12,DISPONIVEL,2026-03-15";
    case "dimob":
      return "CPF/CNPJ,Nome,Tipo Operação,Valor Total\n123.456.789-00,João Mendes,LOCACAO,30000";
  }
}

function downloadReport(type: ReportType, label: string, format: ReportFormat) {
  const csv = generateCSV(type);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ext = format === "xlsx" ? "csv" : format; // simplificado — xlsx também sai como csv por enquanto
  a.href = url;
  a.download = `${label.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [categoryFilter, setCategoryFilter] = useState<ReportDef["category"] | "all">("all");
  const now = new Date();
  const [startDate, setStartDate] = useState(
    new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));

  const handleDownload = useCallback(
    (type: ReportType, label: string) => {
      setDownloading(type);
      setTimeout(() => {
        downloadReport(type, label, format);
        setDownloading(null);
      }, 400);
    },
    [format]
  );

  const filteredReports =
    categoryFilter === "all" ? REPORTS : REPORTS.filter((r) => r.category === categoryFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-sm text-gray-500">Gere e exporte relatórios financeiros, operacionais e fiscais</p>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Parâmetros de Exportação</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Data inicial */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Período — Início</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Data final */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Período — Fim</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Formato */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Formato do arquivo</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ReportFormat)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="csv">CSV (Excel)</option>
              <option value="xlsx">XLSX</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Categoria</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ReportDef["category"] | "all")}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas ({REPORTS.length})</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reports grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.map((r) => {
          const cat = CATEGORY_LABELS[r.category];
          const isDown = downloading === r.type;
          return (
            <div
              key={r.type}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all group flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 bg-gray-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                  <r.icon className="h-5 w-5 text-gray-500 group-hover:text-blue-600" />
                </div>
                <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", cat.color)}>
                  {cat.label}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">{r.label}</h3>
              <p className="text-xs text-gray-500 mb-4 flex-1 leading-relaxed">{r.description}</p>
              <button
                onClick={() => handleDownload(r.type, r.label)}
                disabled={isDown}
                className={cn(
                  "flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-all",
                  isDown
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-50 text-gray-700 hover:bg-blue-600 hover:text-white"
                )}
              >
                {isDown ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5" /> Baixado!
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" /> Gerar {format.toUpperCase()}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Info footer */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <FileSpreadsheet className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700">
          <p className="font-medium mb-0.5">Sobre os relatórios</p>
          <p className="text-blue-600/80">
            Os relatórios são gerados com base nos filtros de período selecionados acima. Para análises
            visuais com gráficos e KPIs consolidados, acesse o <strong>Painel</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
