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
  RefreshCw, AlertTriangle, Pencil, Check, Trash2,
} from "lucide-react";
import { appEnvironment } from "@/lib/app-env";
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
  pendingReview: number;
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
  needsReview?: boolean;
  confidence?: number;
  matchedRule?: string;
  importBatchId?: string;
  sourceFile?: string;
  isReconciled?: boolean;
  processingStatus?: string;
  statusReason?: string;
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

interface PreviewRow {
  index: number;
  date: string;
  description: string;
  amount: number;
  isCredit: boolean;
  operationType: string;
  category: string;
  confidence: number;
  needsReview: boolean;
  duplicate: boolean;
  matchedRule: string;
  existingFinancialType?: "EXPENSE" | "REVENUE";
}

interface ImportPreview {
  bankName: string;
  accountInfo?: string;
  bankAccountId?: string;
  transactionCount: number;
  duplicates: number;
  pendingReview: number;
  totalReceitas: number;
  totalDespesas: number;
  months: string[];
  rows: PreviewRow[];
  parseErrors?: string[];
}

interface AccountSummary {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  currentBalance: number;
  totalTransactions: number;
  reviewRequired: number;
  reconciled: number;
  autoCoverage: number;
  inflow: number;
  outflow: number;
  lastImportedAt: string | null;
}

interface ReviewQueueItem {
  id: string;
  monthKey: string;
  batchId?: string;
  date: string;
  description: string;
  amount: number;
  isCredit: boolean;
  category: string;
  confidence: number;
  matchedRule?: string;
  bankName: string;
  processingStatus?: string;
  statusReason?: string;
}

interface ImportBatchSummary {
  id: string;
  importedAt: string;
  bankName: string;
  months: string[];
  transactionCount: number;
  totalReceitas: number;
  totalDespesas: number;
  pendingReview: number;
  reconciledCount: number;
  sourceFile?: string;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ExtratosPage() {
  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [batches, setBatches] = useState<ImportBatchSummary[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [monthDetail, setMonthDetail] = useState<MonthDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const canClearAllStatements = appEnvironment === "homologacao";

  // ── Filtros ──
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);

  // ── Upload ──
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
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
      setAccounts(data.accounts ?? []);
      setBatches(data.batches ?? []);
      setReviewQueue(data.reviewQueue ?? []);
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
    setImportPreview(null);
    setSelectedFile(file);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extratos", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        const details = [...(data.errors ?? []), ...(data.parseErrors ?? []), ...(data.importErrors ?? [])]
          .slice(0, 3)
          .join(" | ");
        setUploadError(details ? `${data.error ?? "Erro ao importar."} ${details}` : data.error ?? "Erro ao importar.");
        return;
      }

      setImportPreview(data);
    } catch {
      setUploadError("Erro de conexão.");
    } finally {
      setUploading(false);
    }
  };

  const confirmImport = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/extratos?confirm=true", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        const details = [...(data.errors ?? []), ...(data.parseErrors ?? []), ...(data.importErrors ?? [])]
          .slice(0, 3)
          .join(" | ");
        setUploadError(details ? `${data.error ?? "Erro ao importar."} ${details}` : data.error ?? "Erro ao importar.");
        return;
      }

      setUploadSuccess(data.message);
      setImportPreview(null);
      await fetchMonths();

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

  const handleClearStatements = async (scope?: { monthKey?: string; batchId?: string }) => {
    const label = scope?.monthKey ? `o mês ${scope.monthKey}` : scope?.batchId ? "este lote de importação" : "todos os extratos importados";
    if (!confirm(`Apagar ${label} e os lançamentos financeiros gerados? Esta ação é apenas para HML.`)) {
      return;
    }

    setCleanupLoading(true);
    setCleanupMessage(null);
    try {
      const params = new URLSearchParams();
      if (scope?.monthKey) params.set("monthKey", scope.monthKey);
      if (scope?.batchId) params.set("batchId", scope.batchId);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const previewResponse = await fetch(`/api/extratos${suffix}`, { method: "DELETE" });
      const preview = await previewResponse.json().catch(() => ({}));
      if (!previewResponse.ok) throw new Error(preview.error ?? "Falha ao simular limpeza dos extratos.");

      if ((preview.removable ?? 0) === 0) {
        setCleanupMessage("Nao ha extratos importados para remover neste ambiente.");
        return;
      }

      params.set("dryRun", "false");
      const cleanupResponse = await fetch(`/api/extratos?${params.toString()}`, { method: "DELETE" });
      const cleanup = await cleanupResponse.json().catch(() => ({}));
      if (!cleanupResponse.ok) throw new Error(cleanup.error ?? "Falha ao limpar extratos.");

      setCleanupMessage(cleanup.message ?? `${cleanup.deleted ?? 0} transacao(oes) removida(s).`);
      setExpandedMonth(null);
      setMonthDetail(null);
      setSearch("");
      setFilterCategory("");
      setReviewOnly(false);
      await fetchMonths();
    } catch (error) {
      setCleanupMessage(error instanceof Error ? error.message : "Falha ao limpar extratos.");
    } finally {
      setCleanupLoading(false);
    }
  };

  // ── Transações filtradas ──
  const filteredTransactions = monthDetail?.statement.transactions.filter((tx) => {
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory && tx.category !== filterCategory) return false;
    if (reviewOnly && !tx.needsReview) return false;
    return true;
  }) ?? [];

  // ── Totais globais ──
  const totalReceitas = months.reduce((s, m) => s + m.totalReceitas, 0);
  const totalDespesas = months.reduce((s, m) => s + m.totalDespesas, 0);
  const totalPendentes = months.reduce((s, m) => s + (m.pendingReview ?? 0), 0);

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
          {canClearAllStatements && (
            <button
              onClick={() => handleClearStatements()}
              disabled={cleanupLoading}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              title="Remove extratos e lançamentos gerados para testar reimportação em HML"
            >
              {cleanupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Limpar teste
            </button>
          )}
          <button
            onClick={() => { setShowUpload(true); setUploadSuccess(null); setUploadError(null); setImportPreview(null); setSelectedFile(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Importar Extrato
          </button>
        </div>
      </div>

      {cleanupMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {cleanupMessage}
        </div>
      )}

      {/* ── Cards globais ── */}
      {months.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">A revisar</p>
            <p className={cn("text-2xl font-bold", totalPendentes > 0 ? "text-amber-700" : "text-green-700")}>
              {totalPendentes}
            </p>
          </div>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Contas monitoradas</h2>
              <p className="text-xs text-gray-500">Cobertura automatica, pendencias e saldo operacional por conta.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{account.bankName}</p>
                    <p className="text-xs text-gray-500">
                      {account.accountType} · {account.accountNumber}
                    </p>
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-1 text-[11px] font-semibold",
                    account.reviewRequired > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {account.autoCoverage}% cobertura
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Saldo atual</p>
                    <p className="mt-1 font-semibold text-gray-900">{formatCurrency(account.currentBalance)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Pendencias</p>
                    <p className={cn("mt-1 font-semibold", account.reviewRequired > 0 ? "text-amber-700" : "text-emerald-700")}>
                      {account.reviewRequired}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Entradas</p>
                    <p className="mt-1 font-semibold text-green-700">{formatCurrency(account.inflow)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Saidas</p>
                    <p className="mt-1 font-semibold text-red-600">{formatCurrency(account.outflow)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{account.totalTransactions} transacoes</span>
                  <span>{account.lastImportedAt ? `Ultimo lote ${formatDate(account.lastImportedAt)}` : "Sem importacao"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(reviewQueue.length > 0 || batches.length > 0) && (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Fila de excecoes</h2>
                <p className="text-xs text-gray-500">Linhas que ainda exigem decisao humana antes de fechar a conciliacao.</p>
              </div>
              <span className={cn(
                "rounded-full px-2 py-1 text-[11px] font-semibold",
                reviewQueue.length > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
              )}>
                {reviewQueue.length} pendencia(s)
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {reviewQueue.length === 0 ? (
                <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-700">
                  Nenhuma excecao aberta no momento.
                </div>
              ) : (
                reviewQueue.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleMonth(item.monthKey)}
                    className="flex w-full items-start justify-between rounded-lg border border-gray-100 px-4 py-3 text-left hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          {item.category}
                        </span>
                        <span className="text-[11px] text-gray-500">{item.bankName}</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-gray-900">{item.description}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDate(item.date)} · {item.confidence}% · {item.statusReason ?? item.matchedRule ?? "sem regra"}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className={cn("text-sm font-semibold", item.isCredit ? "text-green-700" : "text-red-600")}>
                        {item.isCredit ? "+" : "-"}{formatCurrency(item.amount)}
                      </p>
                      <p className="mt-1 text-[11px] text-blue-600">Abrir mes</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Lotes recentes</h2>
              <p className="text-xs text-gray-500">Controle de origem, meses afetados e situacao de cada importacao.</p>
            </div>
            <div className="mt-4 space-y-3">
              {batches.slice(0, 6).map((batch) => (
                <div key={batch.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{batch.sourceFile ?? batch.bankName}</p>
                      <p className="text-xs text-gray-500">
                        {batch.bankName} · {formatDate(batch.importedAt)} · {batch.months.join(", ")}
                      </p>
                    </div>
                    <span className={cn(
                      "rounded-full px-2 py-1 text-[10px] font-semibold",
                      batch.pendingReview > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {batch.pendingReview > 0 ? `${batch.pendingReview} revisar` : `${batch.reconciledCount}/${batch.transactionCount} reconc.`}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Movimentos</p>
                      <p className="font-semibold text-gray-900">{batch.transactionCount}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Entradas</p>
                      <p className="font-semibold text-green-700">{formatCurrency(batch.totalReceitas)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Saidas</p>
                      <p className="font-semibold text-red-600">{formatCurrency(batch.totalDespesas)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                      {canClearAllStatements && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleClearStatements({ monthKey: month.monthKey })}
                            disabled={cleanupLoading}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                          >
                            {cleanupLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            Apagar este mês
                          </button>
                        </div>
                      )}
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
                        <button
                          onClick={() => setReviewOnly((current) => !current)}
                          className={cn(
                            "flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium",
                            reviewOnly
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          )}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          A revisar
                        </button>
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
                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
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
                                    <p className="text-[10px] text-gray-400 truncate max-w-[300px]">
                                      {tx.sourceFile ? `${tx.sourceFile} · ` : ""}{tx.importBatchId ? `lote ${tx.importBatchId}` : tx.matchedRule}
                                    </p>
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
                                          tx.needsReview
                                            ? "bg-amber-100 text-amber-800"
                                            : monthDetail.categorySummary.find((c) => c.category === tx.category)?.color ?? "bg-gray-100 text-gray-700"
                                        )}>
                                          {tx.category}
                                        </span>
                                        {tx.needsReview && (
                                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                                        )}
                                        <Pencil className="h-2.5 w-2.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        {tx.categoryManual && (
                                          <Check className="h-2.5 w-2.5 text-blue-400" />
                                        )}
                                      </button>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="space-y-1">
                                      <span className={cn(
                                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                        tx.processingStatus === "RECONCILED"
                                          ? "bg-emerald-100 text-emerald-700"
                                          : tx.processingStatus === "REVIEW_REQUIRED"
                                            ? "bg-amber-100 text-amber-800"
                                            : tx.processingStatus === "CLASSIFIED_MANUAL"
                                              ? "bg-blue-100 text-blue-700"
                                              : "bg-gray-100 text-gray-700"
                                      )}>
                                        {tx.processingStatus === "RECONCILED"
                                          ? "Conciliada"
                                          : tx.processingStatus === "REVIEW_REQUIRED"
                                            ? "Revisar"
                                            : tx.processingStatus === "CLASSIFIED_MANUAL"
                                              ? "Revisada"
                                              : "Classificada"}
                                      </span>
                                      {tx.statusReason && (
                                        <p className="max-w-[180px] truncate text-[10px] text-gray-400">{tx.statusReason}</p>
                                      )}
                                    </div>
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
              <button onClick={() => { setShowUpload(false); setImportPreview(null); setSelectedFile(null); }} className="text-gray-400 hover:text-gray-600 p-1">
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
                      As transações foram categorizadas automaticamente e gravadas no financeiro. Feche este modal para ver.
                    </p>
                  </div>
                </div>
              ) : importPreview ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">Prévia pronta para confirmar</p>
                    <p className="mt-1 text-xs text-blue-700">
                      {importPreview.bankName} · {importPreview.transactionCount} transação(ões) · {importPreview.months.join(", ")}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-gray-500">Entradas</p>
                        <p className="font-bold text-green-700">{formatCurrency(importPreview.totalReceitas)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-gray-500">Saídas</p>
                        <p className="font-bold text-red-600">{formatCurrency(importPreview.totalDespesas)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-gray-500">Duplicatas</p>
                        <p className="font-bold text-gray-900">{importPreview.duplicates}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-gray-500">A revisar</p>
                        <p className="font-bold text-amber-700">{importPreview.pendingReview}</p>
                      </div>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Data</th>
                          <th className="px-3 py-2 text-left">Descrição</th>
                          <th className="px-3 py-2 text-left">Categoria</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importPreview.rows.slice(0, 80).map((row) => (
                          <tr key={row.index} className={row.duplicate ? "bg-gray-50 text-gray-400" : ""}>
                            <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.date)}</td>
                            <td className="px-3 py-2">
                              <p className="max-w-[180px] truncate">{row.description}</p>
                              <p className="text-[10px] text-gray-400">
                                {row.duplicate ? "duplicata" : row.existingFinancialType ? "conciliável" : row.matchedRule}
                              </p>
                            </td>
                            <td className="px-3 py-2">
                              <span className={cn("rounded px-1.5 py-0.5", row.needsReview ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700")}>
                                {row.category} · {row.confidence}%
                              </span>
                            </td>
                            <td className={cn("px-3 py-2 text-right font-semibold", row.isCredit ? "text-green-700" : "text-red-600")}>
                              {row.isCredit ? "+" : "-"}{formatCurrency(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={confirmImport}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirmar e gravar no financeiro
                  </button>
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
                      accept=".ofx,.qfx,.csv,.txt,.xlsx,.xls,.xml"
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
                    <p className="text-xs text-gray-400 mt-1">OFX, CSV, XLSX ou TXT · Caixa Econômica Federal</p>
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
                onClick={() => { setShowUpload(false); setSearch(""); setFilterCategory(""); setImportPreview(null); setSelectedFile(null); }}
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
