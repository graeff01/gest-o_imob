"use client";

/**
 * Extratos Bancários — Visão Mensal Categorizada
 * -----------------------------------------------
 * Upload OFX/CSV → sistema categoriza automaticamente → visão por mês
 * com resumo por categoria e transações detalhadas.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload, Search, ArrowUpCircle, ArrowDownCircle,
  ChevronDown, ChevronRight, FileText, Loader2, X,
  RefreshCw, Download, AlertTriangle, Pencil, Check,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

// ─── Types (espelham a API) ──────────────────────────────────────────────────

interface MonthSummary {
  id: string;
  monthKey: string;
  label: string;
  bankName: string;
  importedAt: string;
  transactionCount: number;
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  operationType: string;
  isCredit: boolean;
  category: string;
  categoryManual: boolean;
}

interface CategorySummaryItem {
  category: string;
  total: number;
  count: number;
  type: "receita" | "despesa";
  color: string;
}

interface MonthDetail {
  statement: {
    id: string;
    monthKey: string;
    label: string;
    bankName: string;
    transactions: Transaction[];
    totalReceitas: number;
    totalDespesas: number;
    saldo: number;
  };
  categorySummary: CategorySummaryItem[];
  categories: string[];
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ExtratosPage() {
  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [monthDetail, setMonthDetail] = useState<MonthDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Filtros ──
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // ── Upload ──
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Edição de categoria ──
  const [editingTx, setEditingTx] = useState<string | null>(null);

  // ── Fetch meses ──
  const fetchMonths = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/extratos");
      const data = await res.json();
      setMonths(data.months ?? []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMonths(); }, [fetchMonths]);

  // ── Fetch detalhe de um mês ──
  const fetchMonthDetail = useCallback(async (monthKey: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/extratos/${monthKey}`);
      const data = await res.json();
      setMonthDetail(data);
    } catch {
      setMonthDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const toggleMonth = (monthKey: string) => {
    if (expandedMonth === monthKey) {
      setExpandedMonth(null);
      setMonthDetail(null);
    } else {
      setExpandedMonth(monthKey);
      fetchMonthDetail(monthKey);
    }
  };

  // ── Upload do arquivo ──
  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extratos", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error ?? "Erro ao importar.");
        return;
      }

      setUploadSuccess(data.message);
      await fetchMonths();

      // Abre automaticamente o mês importado
      if (data.months?.[0]) {
        setExpandedMonth(data.months[0]);
        fetchMonthDetail(data.months[0]);
      }
    } catch {
      setUploadError("Erro de conexão.");
    } finally {
      setUploading(false);
    }
  };

  // ── Atualizar categoria ──
  const updateCategory = async (monthKey: string, txId: string, newCategory: string) => {
    try {
      await fetch(`/api/extratos/${monthKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId, category: newCategory }),
      });
      setEditingTx(null);
      fetchMonthDetail(monthKey);
    } catch {
      // ignore
    }
  };

  // ── Transações filtradas ──
  const filteredTransactions = monthDetail?.statement.transactions.filter((tx) => {
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory && tx.category !== filterCategory) return false;
    return true;
  }) ?? [];

  // ── Totais globais ──
  const totalReceitas = months.reduce((s, m) => s + m.totalReceitas, 0);
  const totalDespesas = months.reduce((s, m) => s + m.totalDespesas, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Extratos Bancários</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Importe extratos OFX/CSV — categorização automática por mês.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMonths}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setShowUpload(true); setUploadSuccess(null); setUploadError(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Importar Extrato
          </button>
        </div>
      </div>

      {/* ── Cards globais ── */}
      {months.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Meses Importados</p>
            <p className="text-2xl font-bold text-gray-900">{months.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <ArrowUpCircle className="h-3 w-3 text-green-500" /> Total Receitas
            </div>
            <p className="text-xl font-bold text-green-700">{formatCurrency(totalReceitas)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <ArrowDownCircle className="h-3 w-3 text-red-500" /> Total Despesas
            </div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalDespesas)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Saldo Geral</p>
            <p className={cn(
              "text-xl font-bold",
              totalReceitas - totalDespesas >= 0 ? "text-green-700" : "text-red-600"
            )}>
              {formatCurrency(totalReceitas - totalDespesas)}
            </p>
          </div>
        </div>
      )}

      {/* ── Lista de meses ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
        </div>
      ) : months.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <FileText className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum extrato importado</p>
          <p className="text-sm text-gray-400 mt-1">
            Clique em &quot;Importar Extrato&quot; para começar. Aceita OFX e CSV da Caixa Econômica.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {months.map((month) => (
            <div key={month.monthKey} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header do mês — clicável */}
              <button
                onClick={() => toggleMonth(month.monthKey)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  {expandedMonth === month.monthKey
                    ? <ChevronDown className="h-5 w-5 text-gray-400" />
                    : <ChevronRight className="h-5 w-5 text-gray-400" />
                  }
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{month.label}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {month.bankName} · {month.transactionCount} transações
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Receitas</p>
                    <p className="font-semibold text-green-700">{formatCurrency(month.totalReceitas)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Despesas</p>
                    <p className="font-semibold text-red-600">{formatCurrency(month.totalDespesas)}</p>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="text-xs text-gray-400">Saldo</p>
                    <p className={cn(
                      "font-bold",
                      month.saldo >= 0 ? "text-green-700" : "text-red-600"
                    )}>
                      {formatCurrency(month.saldo)}
                    </p>
                  </div>
                </div>
              </button>

              {/* Conteúdo expandido */}
              {expandedMonth === month.monthKey && (
                <div className="border-t border-gray-100">
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-12 text-gray-400">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando transações...
                    </div>
                  ) : monthDetail ? (
                    <div className="p-6 space-y-6">
                      {/* ── Resumo por categoria ── */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Resumo por Categoria</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {monthDetail.categorySummary.map((cat) => (
                            <button
                              key={cat.category}
                              onClick={() => setFilterCategory(
                                filterCategory === cat.category ? "" : cat.category
                              )}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-lg border text-left transition-all",
                                filterCategory === cat.category
                                  ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200"
                                  : "border-gray-100 hover:border-gray-300"
                              )}
                            >
                              <div className="min-w-0">
                                <p className={cn(
                                  "text-[10px] font-medium px-1.5 py-0.5 rounded inline-block mb-1",
                                  cat.color
                                )}>
                                  {cat.category}
                                </p>
                                <p className="text-xs text-gray-400">{cat.count} lançamento(s)</p>
                              </div>
                              <p className={cn(
                                "text-sm font-bold ml-2 whitespace-nowrap",
                                cat.type === "receita" ? "text-green-700" : "text-gray-900"
                              )}>
                                {formatCurrency(cat.total)}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Filtros das transações ── */}
                      <div className="flex items-center gap-3">
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
                        {filterCategory && (
                          <button
                            onClick={() => setFilterCategory("")}
                            className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100"
                          >
                            {filterCategory} <X className="h-3 w-3" />
                          </button>
                        )}
                        <p className="text-xs text-gray-400 ml-auto">
                          {filteredTransactions.length} de {monthDetail.statement.transactions.length} transações
                        </p>
                      </div>

                      {/* ── Tabela de transações ── */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                              <tr>
                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Data</th>
                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Descrição</th>
                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Tipo</th>
                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Categoria</th>
                                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Valor</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {filteredTransactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                                    {formatDate(tx.date)}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <p className="text-gray-900 text-xs truncate max-w-[300px]">{tx.description}</p>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                      {tx.operationType}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    {editingTx === tx.id ? (
                                      <select
                                        defaultValue={tx.category}
                                        autoFocus
                                        onChange={(e) => updateCategory(month.monthKey, tx.id, e.target.value)}
                                        onBlur={() => setEditingTx(null)}
                                        className="text-xs border border-blue-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      >
                                        {monthDetail.categories.map((cat) => (
                                          <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <button
                                        onClick={() => setEditingTx(tx.id)}
                                        className="group flex items-center gap-1"
                                        title="Clique para alterar categoria"
                                      >
                                        <span className={cn(
                                          "text-[10px] font-medium px-1.5 py-0.5 rounded",
                                          monthDetail.categorySummary.find((c) => c.category === tx.category)?.color ?? "bg-gray-100 text-gray-700"
                                        )}>
                                          {tx.category}
                                        </span>
                                        <Pencil className="h-2.5 w-2.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        {tx.categoryManual && (
                                          <Check className="h-2.5 w-2.5 text-blue-400" />
                                        )}
                                      </button>
                                    )}
                                  </td>
                                  <td className={cn(
                                    "px-4 py-2.5 text-right font-semibold text-xs whitespace-nowrap",
                                    tx.isCredit ? "text-green-700" : "text-red-600"
                                  )}>
                                    {tx.isCredit ? "+" : "-"}{formatCurrency(tx.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL DE UPLOAD
      ═══════════════════════════════════════════════════════════════════ */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Importar Extrato</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Arquivo OFX ou CSV da Caixa Econômica Federal
                </p>
              </div>
              <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6 space-y-4">
              {uploadSuccess ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700">
                  <ArrowUpCircle className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{uploadSuccess}</p>
                    <p className="text-xs mt-1 text-green-600">
                      As transações foram categorizadas automaticamente. Feche este modal para ver.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <label className={cn(
                    "flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors",
                    uploading
                      ? "border-blue-300 bg-blue-50 cursor-not-allowed"
                      : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                  )}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".ofx,.qfx,.csv,.txt"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                      }}
                    />
                    {uploading ? (
                      <Loader2 className="h-8 w-8 text-blue-400 animate-spin mb-2" />
                    ) : (
                      <Upload className="h-8 w-8 text-gray-300 mb-2" />
                    )}
                    <p className="text-sm font-medium text-gray-700">
                      {uploading ? "Importando e categorizando..." : "Clique ou arraste o arquivo"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">OFX, CSV ou TXT · Caixa Econômica Federal</p>
                    <a
                      href="/api/extratos/sample"
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 text-xs text-blue-500 hover:text-blue-700 underline underline-offset-2"
                    >
                      Baixar extrato de exemplo (OFX)
                    </a>
                  </label>

                  {uploadError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <p>{uploadError}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end p-6 border-t border-gray-100">
              <button
                onClick={() => { setShowUpload(false); setSearch(""); setFilterCategory(""); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                {uploadSuccess ? "Fechar e ver resultados" : "Fechar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
