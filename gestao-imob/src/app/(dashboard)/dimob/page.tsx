"use client";

import { useState } from "react";
import {
  FileOutput,
  Download,
  Search,
  Building2,
  User,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  Info,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

type Tab = "config" | "preview" | "generate";

interface DimobEntry {
  locatario_nome: string;
  locatario_cpf: string;
  proprietario_nome: string;
  proprietario_cpf: string;
  imovel_endereco: string;
  valor_total: number;
  meses: number;
  contrato_numero: string;
}

// Dados mock para visualização
const MOCK_ENTRIES: DimobEntry[] = [
  {
    locatario_nome: "João Carlos Mendes",
    locatario_cpf: "123.456.789-00",
    proprietario_nome: "Maria Aparecida Lima",
    proprietario_cpf: "987.654.321-00",
    imovel_endereco: "Av. Independência, 1200, Ap 301 - Moinhos de Vento",
    valor_total: 48000,
    meses: 12,
    contrato_numero: "MV-2025-0001",
  },
  {
    locatario_nome: "Empresa XYZ Ltda",
    locatario_cpf: "12.345.678/0001-90",
    proprietario_nome: "Carlos Eduardo Souza",
    proprietario_cpf: "111.222.333-44",
    imovel_endereco: "Rua Padre Chagas, 302, Sala 5 - Moinhos de Vento",
    valor_total: 72000,
    meses: 12,
    contrato_numero: "MV-2025-0002",
  },
  {
    locatario_nome: "Ana Paula Ferreira",
    locatario_cpf: "555.666.777-88",
    proprietario_nome: "Roberto Almeida Costa",
    proprietario_cpf: "444.333.222-11",
    imovel_endereco: "R. Mostardeiro, 555, Ap 12 - Moinhos de Vento",
    valor_total: 36000,
    meses: 10,
    contrato_numero: "MV-2025-0003",
  },
  {
    locatario_nome: "Construtora Delta S.A.",
    locatario_cpf: "98.765.432/0001-10",
    proprietario_nome: "Lucia Hoffmann",
    proprietario_cpf: "212.121.212-12",
    imovel_endereco: "Av. Goethe, 77, Cobertura - Moinhos de Vento",
    valor_total: 120000,
    meses: 12,
    contrato_numero: "MV-2025-0004",
  },
  {
    locatario_nome: "Fernando Henrique Dias",
    locatario_cpf: "777.888.999-00",
    proprietario_nome: "Imobiliária Moinhos de Vento Ltda",
    proprietario_cpf: "00.000.000/0001-91",
    imovel_endereco: "R. Ramiro Barcelos, 820, Ap 401 - Rio Branco",
    valor_total: 28800,
    meses: 8,
    contrato_numero: "MV-2025-0005",
  },
];

function gerarTextoDimob(entries: DimobEntry[], cnpj: string, ano: string): string {
  const lines: string[] = [];
  const cnpjLimpo = cnpj.replace(/\D/g, "").padEnd(14, "0").substring(0, 14);
  const anoBase = ano;

  // Registro 10 - Identificação da Pessoa Jurídica
  lines.push(
    `10${cnpjLimpo}IMOBILIARIA MOINHOS DE VENTO LTDA          ${anoBase}DIMOB00001`
  );

  entries.forEach((entry, idx) => {
    const seq = String(idx + 1).padStart(5, "0");
    const cpfLoc = entry.locatario_cpf.replace(/\D/g, "").padEnd(14, " ").substring(0, 14);
    const cpfProp = entry.proprietario_cpf.replace(/\D/g, "").padEnd(14, " ").substring(0, 14);
    const nomeLoc = entry.locatario_nome.toUpperCase().padEnd(60, " ").substring(0, 60);
    const nomeProp = entry.proprietario_nome.toUpperCase().padEnd(60, " ").substring(0, 60);
    const valorStr = String(Math.round(entry.valor_total * 100)).padStart(15, "0");
    const mesesStr = String(entry.meses).padStart(2, "0");

    // Registro 30 - Dados do Locatário
    lines.push(`30${seq}${cpfLoc}${nomeLoc}${anoBase}`);
    // Registro 50 - Dados do Proprietário
    lines.push(`50${seq}${cpfProp}${nomeProp}${anoBase}`);
    // Registro 70 - Dados do Contrato
    lines.push(`70${seq}${valorStr}${mesesStr}${entry.contrato_numero.padEnd(20, " ").substring(0, 20)}`);
  });

  // Registro 90 - Encerramento
  lines.push(`90${cnpjLimpo}${String(entries.length).padStart(8, "0")}${anoBase}`);

  return lines.join("\r\n");
}

function downloadTxt(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DimobPage() {
  const [activeTab, setActiveTab] = useState<Tab>("config");
  const [ano, setAno] = useState("2025");
  const [cnpj, setCnpj] = useState("00.000.000/0001-91");
  const [loading, setLoading] = useState(false);
  const [entries] = useState<DimobEntry[]>(MOCK_ENTRIES);
  const [search, setSearch] = useState("");

  const totalGeral = entries.reduce((s, e) => s + e.valor_total, 0);
  const filtered = entries.filter(
    (e) =>
      e.locatario_nome.toLowerCase().includes(search.toLowerCase()) ||
      e.proprietario_nome.toLowerCase().includes(search.toLowerCase()) ||
      e.contrato_numero.toLowerCase().includes(search.toLowerCase())
  );

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      const txt = gerarTextoDimob(entries, cnpj, ano);
      downloadTxt(txt, `DIMOB_${ano}_${cnpj.replace(/\D/g, "")}.txt`);
      setLoading(false);
    }, 1200);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "config", label: "1. Configuração", icon: Building2 },
    { id: "preview", label: "2. Pré-visualização", icon: Search },
    { id: "generate", label: "3. Gerar Arquivo", icon: Download },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileOutput className="h-6 w-6 text-blue-700" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">DIMOB</h1>
            <span className="text-xs font-bold bg-blue-600 text-white px-2 py-1 rounded-full">
              Receita Federal
            </span>
          </div>
          <p className="text-gray-500 text-sm ml-0">
            Declaração de Informações sobre Atividades Imobiliárias — geração automática do arquivo .txt
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <span className="font-semibold">Modo demonstração:</span> os dados abaixo são mockados para visualização da estrutura.
          Com o banco de dados ativo, o sistema cruzará automaticamente todos os contratos de locação do ano-base selecionado.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Config */}
      {activeTab === "config" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Dados da Imobiliária
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CNPJ da Imobiliária
              </label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ano-base da Declaração
              </label>
              <select
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2022, 2023, 2024, 2025].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveTab("preview")}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Próximo: Pré-visualizar
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Registros do Layout DIMOB
            </h3>
            <div className="space-y-3 text-sm">
              {[
                { code: "Reg. 10", desc: "Identificação da empresa declarante" },
                { code: "Reg. 30", desc: "Dados do locatário (CPF/CNPJ + nome)" },
                { code: "Reg. 50", desc: "Dados do proprietário (CPF/CNPJ + nome)" },
                { code: "Reg. 70", desc: "Dados do contrato (valor pago + meses)" },
                { code: "Reg. 90", desc: "Encerramento — totalizador de registros" },
              ].map((r) => (
                <div key={r.code} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded flex-shrink-0">
                    {r.code}
                  </span>
                  <span className="text-gray-600">{r.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Preview */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Contratos declarados</p>
              <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Total de aluguéis {ano}</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(totalGeral)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Ano-base</p>
              <p className="text-2xl font-bold text-blue-700">{ano}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por locatário, proprietário ou contrato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Contrato</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" /> Locatário
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> Proprietário
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Imóvel</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Meses</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Valor Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((entry) => (
                  <tr key={entry.contrato_numero} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">
                      {entry.contrato_numero}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{entry.locatario_nome}</p>
                      <p className="text-xs text-gray-400">{entry.locatario_cpf}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{entry.proprietario_nome}</p>
                      <p className="text-xs text-gray-400">{entry.proprietario_cpf}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                      {entry.imovel_endereco}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-gray-700">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {entry.meses}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">
                      {formatCurrency(entry.valor_total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" />
                        OK
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setActiveTab("generate")}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Próximo: Gerar Arquivo
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab: Generate */}
      {activeTab === "generate" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Summary before download */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Resumo da Declaração</h3>

            <div className="space-y-3">
              {[
                { label: "Ano-base", value: ano },
                { label: "CNPJ Declarante", value: cnpj },
                { label: "Total de contratos", value: `${entries.length} contratos` },
                { label: "Valor total declarado", value: formatCurrency(totalGeral) },
                { label: "Registros no arquivo", value: `${entries.length * 3 + 2} linhas` },
                { label: "Formato", value: "Layout DIMOB — Receita Federal" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-500">{item.label}</span>
                  <span className="font-medium text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all",
                loading
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100"
              )}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Gerando arquivo...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  Baixar DIMOB_{ano}.txt
                </>
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Próximos Passos
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              {[
                "Abrir o programa validador DIMOB da Receita Federal (ReceitaNet)",
                "Importar o arquivo .txt gerado via menu 'Arquivo → Importar'",
                "Validar as pendências apontadas pelo validador",
                "Transmitir a declaração pelo próprio ReceitaNet ou via e-CAC",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
