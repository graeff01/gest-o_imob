"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle2,
  Clock,
  X,
  FileText,
  Building2,
  Link2,
  AlertTriangle,
  Ban,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { detectAndParse, suggestCategory, type ParsedTransaction } from "@/lib/utils/bank-parsers";

type Tab = "transacoes" | "importar" | "conciliar";

interface MockTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  operationType: string;
  isCredit: boolean;
  isReconciled: boolean;
  reconciledWith?: string;
  suggestedCategory?: string | null;
  bankName: string;
}

// Dados mock para visualização
const MOCK_TRANSACTIONS: MockTransaction[] = [
  { id: "1", date: "2026-04-01", description: "PIX RECEBIDO - ALUGUEL AP 301 INDEPENDENCIA", amount: 3200, operationType: "PIX", isCredit: true, isReconciled: true, reconciledWith: "Receita #R-2026-041", suggestedCategory: "Aluguel", bankName: "Caixa Econômica Federal", balance: 45320 },
  { id: "2", date: "2026-04-01", description: "PIX RECEBIDO - ALUGUEL SALA 5 PADRE CHAGAS", amount: 5000, operationType: "PIX", isCredit: true, isReconciled: true, reconciledWith: "Receita #R-2026-042", suggestedCategory: "Aluguel", bankName: "Caixa Econômica Federal", balance: 50320 },
  { id: "3", date: "2026-04-02", description: "PAGTO BOLETO - CEEE ENERGIA ELETRICA", amount: 847.50, operationType: "BOLETO", isCredit: false, isReconciled: true, reconciledWith: "Despesa #D-2026-018", suggestedCategory: "Contas de Consumo", bankName: "Caixa Econômica Federal", balance: 49472.50 },
  { id: "4", date: "2026-04-03", description: "TED ENVIADA - COMISSAO LUCAS RODRIGUES", amount: 1280, operationType: "TED", isCredit: false, isReconciled: false, suggestedCategory: "Folha Locação", bankName: "Caixa Econômica Federal", balance: 48192.50 },
  { id: "5", date: "2026-04-03", description: "PIX ENVIADO - AUXILIADORA PREDIAL ROYALTIES MAR", amount: 8750, operationType: "PIX", isCredit: false, isReconciled: false, suggestedCategory: "Op. Locação", bankName: "Caixa Econômica Federal", balance: 39442.50 },
  { id: "6", date: "2026-04-04", description: "TARIFA MANUT CONTA ABRIL", amount: 32.50, operationType: "TARIFA", isCredit: false, isReconciled: false, suggestedCategory: "Tarifas Bancárias", bankName: "Caixa Econômica Federal", balance: 39410 },
  { id: "7", date: "2026-04-04", description: "PIX RECEBIDO - PIPEIMOB REPASSE SEMANAL", amount: 12400, operationType: "PIX", isCredit: true, isReconciled: false, suggestedCategory: null, bankName: "Caixa Econômica Federal", balance: 51810 },
  { id: "8", date: "2026-04-05", description: "PAGTO BOLETO - GOOGLE ADS CAMPANHA LOCACAO", amount: 1500, operationType: "BOLETO", isCredit: false, isReconciled: false, suggestedCategory: "Op. Locação", bankName: "Caixa Econômica Federal", balance: 50310 },
];

export default function ExtratosPage() {
  const [activeTab, setActiveTab] = useState<Tab>("transacoes");
  const [transactions, setTransactions] = useState<MockTransaction[]>(MOCK_TRANSACTIONS);
  const [search, setSearch] = useState("");
  const [filterReconciled, setFilterReconciled] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  // Import state
  const [importResult, setImportResult] = useState<{
    parsed: ParsedTransaction[];
    bankName: string;
    errors: string[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Conciliation state
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);

  const filtered = transactions.filter((t) => {
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterReconciled === "true" && !t.isReconciled) return false;
    if (filterReconciled === "false" && t.isReconciled) return false;
    if (filterType && t.operationType !== filterType) return false;
    return true;
  });

  const totalCredits = filtered.filter((t) => t.isCredit).reduce((s, t) => s + t.amount, 0);
  const totalDebits = filtered.filter((t) => !t.isCredit).reduce((s, t) => s + t.amount, 0);
  const reconciledCount = filtered.filter((t) => t.isReconciled).length;
  const pendingCount = filtered.filter((t) => !t.isReconciled).length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const result = detectAndParse(content, file.name);
      setImportResult({
        parsed: result.transactions,
        bankName: result.bankName,
        errors: result.errors,
      });
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!importResult) return;
    setImporting(true);

    // Simular importação (sem banco, adiciona aos mock)
    const newTxs: MockTransaction[] = importResult.parsed.map((tx, i) => ({
      id: `imp_${Date.now()}_${i}`,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      balance: tx.balance,
      operationType: tx.operationType,
      isCredit: tx.isCredit,
      isReconciled: false,
      suggestedCategory: suggestCategory(tx.description),
      bankName: importResult.bankName,
    }));

    setTimeout(() => {
      setTransactions([...newTxs, ...transactions]);
      setImportResult(null);
      setImporting(false);
      setActiveTab("transacoes");
    }, 800);
  };

  const handleReconcile = (txId: string) => {
    setTransactions(
      transactions.map((t) =>
        t.id === txId ? { ...t, isReconciled: true, reconciledWith: "Conciliado manualmente" } : t
      )
    );
    setReconcilingId(null);
  };

  const handleIgnore = (txId: string) => {
    setTransactions(
      transactions.map((t) =>
        t.id === txId ? { ...t, isReconciled: true, reconciledWith: "Ignorado" } : t
      )
    );
  };

  const opTypes = [...new Set(transactions.map((t) => t.operationType))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Extratos Bancários</h1>
          <p className="text-sm text-gray-500">Importe extratos, visualize transações e concilie com o financeiro.</p>
        </div>
        <button
          onClick={() => { setActiveTab("importar"); setImportResult(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Importar Extrato
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Transações</p>
          <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <ArrowUpCircle className="h-3 w-3 text-green-500" /> Entradas
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalCredits)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <ArrowDownCircle className="h-3 w-3 text-red-500" /> Saídas
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDebits)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" /> Conciliados
          </div>
          <p className="text-2xl font-bold text-green-700">{reconciledCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <Clock className="h-3 w-3 text-amber-500" /> Pendentes
          </div>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { id: "transacoes" as Tab, label: "Todas as Transações" },
          { id: "conciliar" as Tab, label: `Pendentes (${pendingCount})` },
          { id: "importar" as Tab, label: "Importar Arquivo" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Transações */}
      {(activeTab === "transacoes" || activeTab === "conciliar") && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {activeTab === "transacoes" && (
              <select
                value={filterReconciled}
                onChange={(e) => setFilterReconciled(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Todos os status</option>
                <option value="true">Conciliados</option>
                <option value="false">Pendentes</option>
              </select>
            )}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Todos os tipos</option>
              {opTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Descrição</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    {activeTab === "conciliar" && (
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(activeTab === "conciliar" ? filtered.filter((t) => !t.isReconciled) : filtered).map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[280px]">{tx.description}</p>
                        {tx.reconciledWith && (
                          <p className="text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                            <Link2 className="h-3 w-3" />{tx.reconciledWith}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {tx.operationType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {tx.suggestedCategory || "—"}
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-right font-semibold whitespace-nowrap",
                        tx.isCredit ? "text-green-700" : "text-red-600"
                      )}>
                        {tx.isCredit ? "+" : "-"}{formatCurrency(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-xs">
                        {tx.balance !== undefined ? formatCurrency(tx.balance) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tx.isReconciled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            <Clock className="h-3 w-3" /> Pendente
                          </span>
                        )}
                      </td>
                      {activeTab === "conciliar" && !tx.isReconciled && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleReconcile(tx.id)}
                              className="p-1.5 border border-green-200 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                              title="Conciliar"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleIgnore(tx.id)}
                              className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors"
                              title="Ignorar"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Importar */}
      {activeTab === "importar" && (
        <div className="max-w-3xl space-y-6">
          {!importResult ? (
            <>
              {/* Upload Area */}
              <div className="bg-white rounded-xl border border-gray-200 p-8">
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.ofx,.qfx,.txt" onChange={handleFileUpload} />
                <div
                  className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-700">Selecione o arquivo do extrato</p>
                  <p className="text-sm text-gray-400 mt-2">CSV, OFX ou TXT - Caixa Econômica ou Pipeimob</p>
                </div>
              </div>

              {/* Supported Formats */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Formatos suportados</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { bank: "Caixa Econômica", format: "CSV", desc: "Extrato exportado do Internet Banking em formato CSV (ponto e vírgula)" },
                    { bank: "Caixa Econômica", format: "OFX", desc: "Arquivo OFX/QFX gerado pelo Internet Banking da Caixa" },
                    { bank: "Pipeimob", format: "CSV", desc: "Relatório de operações exportado da plataforma Pipeimob" },
                  ].map((item) => (
                    <div key={`${item.bank}-${item.format}`} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-900">{item.bank}</span>
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">{item.format}</span>
                      </div>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Import Preview */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-gray-900">Pré-visualização da Importação</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {importResult.parsed.length} transações encontradas — <span className="font-medium">{importResult.bankName}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setImportResult(null)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 text-sm font-medium mb-1">
                      <AlertTriangle className="h-4 w-4" /> {importResult.errors.length} avisos durante o parsing
                    </div>
                    <div className="text-xs text-amber-600 space-y-0.5">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <p key={i}>{err}</p>
                      ))}
                      {importResult.errors.length > 5 && (
                        <p>...e mais {importResult.errors.length - 5} avisos</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Total de linhas</p>
                    <p className="text-lg font-bold text-gray-900">{importResult.parsed.length}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-gray-500">Entradas</p>
                    <p className="text-lg font-bold text-green-700">
                      {formatCurrency(importResult.parsed.filter((t) => t.isCredit).reduce((s, t) => s + t.amount, 0))}
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-xs text-gray-500">Saídas</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(importResult.parsed.filter((t) => !t.isCredit).reduce((s, t) => s + t.amount, 0))}
                    </p>
                  </div>
                </div>

                {/* Preview table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[350px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Data</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Descrição</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Tipo</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Valor</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Categoria Sugerida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {importResult.parsed.slice(0, 50).map((tx, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">{formatDate(tx.date)}</td>
                          <td className="px-3 py-2 text-gray-900 truncate max-w-[200px] text-xs">{tx.description}</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">{tx.operationType}</span>
                          </td>
                          <td className={cn("px-3 py-2 text-right font-medium text-xs", tx.isCredit ? "text-green-700" : "text-red-600")}>
                            {tx.isCredit ? "+" : "-"}{formatCurrency(tx.amount)}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-400">{suggestCategory(tx.description) || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importResult.parsed.length > 50 && (
                    <div className="px-3 py-2 bg-gray-50 text-xs text-gray-400 text-center">
                      Exibindo 50 de {importResult.parsed.length} transações
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setImportResult(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmImport}
                    disabled={importing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {importing ? (
                      <>Importando...</>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Confirmar Importação ({importResult.parsed.length} transações)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
