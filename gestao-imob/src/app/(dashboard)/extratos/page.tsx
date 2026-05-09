"use client";

/**
 * Extratos BancÃ¡rios â€” VisÃ£o Mensal Categorizada
 * -----------------------------------------------
 * Upload OFX/CSV â†’ sistema categoriza automaticamente â†’ visÃ£o por mÃªs
 * com resumo por categoria e transaÃ§Ãµes detalhadas.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload, Search, ArrowUpCircle, ArrowDownCircle,
  ChevronDown, ChevronRight, FileText, Loader2, X,
  RefreshCw, AlertTriangle, Pencil, Check, Trash2, Ban, RotateCcw,
} from "lucide-react";
import { appEnvironment } from "@/lib/app-env";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

// â”€â”€â”€ Types (espelham a API) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

interface RuleItem {
  id: string;
  pattern: string;
  kind: "receita" | "despesa";
  category_label: string;
  priority: number;
  match_mode: string;
  use_count: number;
  confidence: number;
  is_active: boolean;
  scope_bank_account_id?: string | null;
}

interface RuleCategoryOption {
  id: string;
  name: string;
}

interface RuleBankAccountOption {
  id: string;
  bank_name: string;
  account_number: string;
}

interface AuditTimelineEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorType: "HUMAN" | "AUTOMATION" | "SYSTEM";
  action: string;
  entityType: string;
  entityLabel: string;
  summary: string;
  severity: "INFO" | "WARN" | "CRITICAL";
}

interface ReconcileCandidate {
  id: string;
  label: string;
  amount: number;
  date: string;
  kind: "REVENUE" | "EXPENSE";
}


// â”€â”€â”€ Componente principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ExtratosPage() {
  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [monthDetail, setMonthDetail] = useState<MonthDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [transactionActionId, setTransactionActionId] = useState<string | null>(null);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [ruleCategories, setRuleCategories] = useState<RuleCategoryOption[]>([]);
  const [ruleAccounts, setRuleAccounts] = useState<RuleBankAccountOption[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditTimelineEvent[]>([]);
  const [reconcileModal, setReconcileModal] = useState<{ monthKey: string; tx: Transaction } | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileSaving, setReconcileSaving] = useState(false);
  const [reconcileCandidates, setReconcileCandidates] = useState<ReconcileCandidate[]>([]);
  const [selectedReconcileCandidate, setSelectedReconcileCandidate] = useState<string>("");
  const [ruleForm, setRuleForm] = useState({
    pattern: "",
    kind: "despesa" as "receita" | "despesa",
    categoryLabel: "",
    categoryId: "",
    matchMode: "CONTAINS",
    priority: "100",
    scopeBankAccountId: "",
  });
  const canClearAllStatements = appEnvironment === "homologacao";

  // â”€â”€ Filtros â”€â”€
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);

  // â”€â”€ Upload â”€â”€
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // â”€â”€ EdiÃ§Ã£o de categoria â”€â”€
  const [editingTx, setEditingTx] = useState<string | null>(null);

  // â”€â”€ Fetch meses â”€â”€
  const fetchMonths = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/extratos");
      const data = await res.json();
      setMonths(data.months ?? []);
      setAccounts(data.accounts ?? []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMonths(); }, [fetchMonths]);

  // â”€â”€ Fetch detalhe de um mÃªs â”€â”€
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

  // â”€â”€ Upload do arquivo â”€â”€
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
      setUploadError("Erro de conexÃ£o.");
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
      setUploadError("Erro de conexÃ£o.");
    } finally {
      setUploading(false);
    }
  };

  // â”€â”€ Atualizar categoria â”€â”€
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

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const response = await fetch("/api/extratos/regras", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar regras.");

      setRules(data.rules ?? []);
      setRuleCategories(data.categories ?? []);
      setRuleAccounts(data.bankAccounts ?? []);
    } catch (error) {
      setCleanupMessage(error instanceof Error ? error.message : "Falha ao carregar regras.");
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const openRules = async () => {
    setRulesOpen(true);
    if (rules.length === 0) {
      await loadRules();
    }
  };

  const saveRule = async () => {
    setRulesSaving(true);
    setCleanupMessage(null);
    try {
      const response = await fetch("/api/extratos/regras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: ruleForm.pattern,
          kind: ruleForm.kind,
          categoryLabel: ruleForm.categoryLabel,
          categoryId: ruleForm.kind === "despesa" ? ruleForm.categoryId || null : null,
          matchMode: ruleForm.matchMode,
          priority: Number(ruleForm.priority || "100"),
          scopeBankAccountId: ruleForm.scopeBankAccountId || null,
          department: "AMBOS",
          confidence: 100,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Falha ao salvar regra.");

      setRuleForm({
        pattern: "",
        kind: "despesa",
        categoryLabel: "",
        categoryId: "",
        matchMode: "CONTAINS",
        priority: "100",
        scopeBankAccountId: "",
      });
      await loadRules();
    } catch (error) {
      setCleanupMessage(error instanceof Error ? error.message : "Falha ao salvar regra.");
    } finally {
      setRulesSaving(false);
    }
  };

  const toggleRuleActive = async (rule: RuleItem) => {
    try {
      const response = await fetch("/api/extratos/regras", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, isActive: !rule.is_active }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Falha ao atualizar regra.");
      await loadRules();
    } catch (error) {
      setCleanupMessage(error instanceof Error ? error.message : "Falha ao atualizar regra.");
    }
  };

  const openAudit = async () => {
    setAuditOpen(true);
    setAuditLoading(true);
    try {
      const response = await fetch("/api/audit-overview", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar auditoria.");

      const filtered = (data.events ?? []).filter((event: AuditTimelineEvent) =>
        event.action.toLowerCase().startsWith("bank.") ||
        event.entityType.toLowerCase().includes("banc") ||
        event.entityType.toLowerCase().includes("bank")
      );
      setAuditEvents(filtered.slice(0, 40));
    } catch (error) {
      setCleanupMessage(error instanceof Error ? error.message : "Falha ao carregar auditoria.");
    } finally {
      setAuditLoading(false);
    }
  };

  const openReconcile = async (monthKey: string, tx: Transaction) => {
    setReconcileModal({ monthKey, tx });
    setSelectedReconcileCandidate("");
    setReconcileLoading(true);
    try {
      const [year, month] = monthKey.split("-");
      const endpoint = tx.isCredit
        ? `/api/revenues?month=${Number(month)}&year=${Number(year)}&limit=100`
        : `/api/expenses?month=${Number(month)}&year=${Number(year)}&limit=100`;
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar candidatos.");

      const rawItems = tx.isCredit ? data.revenues ?? [] : data.expenses ?? [];
      const candidates = rawItems
        .map((item: Record<string, unknown>) => ({
          id: String(item.id),
          label: String(item.description ?? "Lancamento"),
          amount: Number(item.amount ?? 0),
          date: String(item.date ?? ""),
          kind: tx.isCredit ? "REVENUE" as const : "EXPENSE" as const,
        }))
        .sort((a: ReconcileCandidate, b: ReconcileCandidate) => {
          const aExact = Math.abs(a.amount - tx.amount) < 0.001 ? 0 : 1;
          const bExact = Math.abs(b.amount - tx.amount) < 0.001 ? 0 : 1;
          return aExact - bExact;
        });
      setReconcileCandidates(candidates);
      const exact = candidates.find((candidate: ReconcileCandidate) => Math.abs(candidate.amount - tx.amount) < 0.001);
      if (exact) setSelectedReconcileCandidate(exact.id);
    } catch (error) {
      setCleanupMessage(error instanceof Error ? error.message : "Falha ao carregar candidatos.");
    } finally {
      setReconcileLoading(false);
    }
  };

  const confirmManualReconcile = async () => {
    if (!reconcileModal || !selectedReconcileCandidate) return;
    setReconcileSaving(true);
    setCleanupMessage(null);
    try {
      const response = await fetch("/api/bank-transactions/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: reconcileModal.tx.id,
          reconcileType: reconcileModal.tx.isCredit ? "REVENUE" : "EXPENSE",
          reconcileWithId: selectedReconcileCandidate,
          reason: "Conciliado manualmente a partir da revisao mensal do extrato.",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Falha ao conciliar transacao.");

      await fetchMonthDetail(reconcileModal.monthKey);
      await fetchMonths();
      setReconcileModal(null);
      setReconcileCandidates([]);
    } catch (error) {
      setCleanupMessage(error instanceof Error ? error.message : "Falha ao conciliar transacao.");
    } finally {
      setReconcileSaving(false);
    }
  };

  const applyTransactionAction = async (
    monthKey: string,
    txId: string,
    action: "ignore" | "restore" | "unreconcile"
  ) => {
    setTransactionActionId(`${txId}:${action}`);
    setCleanupMessage(null);
    try {
      const response = await fetch(`/api/extratos/${monthKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Falha ao atualizar a transacao.");
      }

      await fetchMonthDetail(monthKey);
      await fetchMonths();
    } catch (error) {
      setCleanupMessage(error instanceof Error ? error.message : "Falha ao atualizar a transacao.");
    } finally {
      setTransactionActionId(null);
    }
  };

  const handleClearStatements = async (scope?: { monthKey?: string; batchId?: string }) => {
    const label = scope?.monthKey ? `o mÃªs ${scope.monthKey}` : scope?.batchId ? "este lote de importaÃ§Ã£o" : "todos os extratos importados";
    if (!confirm(`Apagar ${label} e os lanÃ§amentos financeiros gerados? Esta aÃ§Ã£o Ã© apenas para HML.`)) {
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

  // â”€â”€ TransaÃ§Ãµes filtradas â”€â”€
  const filteredTransactions = monthDetail?.statement.transactions.filter((tx) => {
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory && tx.category !== filterCategory) return false;
    if (reviewOnly && !tx.needsReview) return false;
    return true;
  }) ?? [];

  // â”€â”€ Totais globais â”€â”€
  const totalReceitas = months.reduce((s, m) => s + m.totalReceitas, 0);
  const totalDespesas = months.reduce((s, m) => s + m.totalDespesas, 0);
  const totalPendentes = months.reduce((s, m) => s + (m.pendingReview ?? 0), 0);

  const getStatusMeta = (status?: string) => {
    switch (status) {
      case "RECONCILED":
        return { label: "Conciliada", tone: "bg-emerald-100 text-emerald-700" };
      case "REVIEW_REQUIRED":
        return { label: "Revisar", tone: "bg-amber-100 text-amber-800" };
      case "CLASSIFIED_MANUAL":
        return { label: "Revisada", tone: "bg-blue-100 text-blue-700" };
      case "POSTED_FINANCIAL":
        return { label: "Lancada", tone: "bg-violet-100 text-violet-700" };
      case "IGNORED":
        return { label: "Ignorada", tone: "bg-slate-100 text-slate-700" };
      case "REVERSED":
        return { label: "Reaberta", tone: "bg-orange-100 text-orange-700" };
      default:
        return { label: "Classificada", tone: "bg-gray-100 text-gray-700" };
    }
  };

  return (
    <div className="space-y-6">
      {/* â”€â”€ Header â”€â”€ */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Extratos BancÃ¡rios</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Importe extratos OFX/CSV â€” categorizaÃ§Ã£o automÃ¡tica por mÃªs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openAudit}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Auditoria
          </button>
          <button
            onClick={openRules}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Regras
          </button>
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
              title="Remove extratos e lanÃ§amentos gerados para testar reimportaÃ§Ã£o em HML"
            >
              {cleanupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Limpar dados importados
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

      {/* â”€â”€ Cards globais â”€â”€ */}
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
                      {account.accountType} Â· {account.accountNumber}
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


      {/* â”€â”€ Lista de meses â”€â”€ */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
        </div>
      ) : months.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <FileText className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum extrato importado</p>
          <p className="text-sm text-gray-400 mt-1">
            Clique em &quot;Importar Extrato&quot; para comeÃ§ar. Aceita OFX e CSV da Caixa EconÃ´mica.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {months.map((month) => (
            <div key={month.monthKey} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header do mÃªs â€” clicÃ¡vel */}
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
                      {month.bankName} Â· {month.transactionCount} transaÃ§Ãµes
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

              {/* ConteÃºdo expandido */}
              {expandedMonth === month.monthKey && (
                <div className="border-t border-gray-100">
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-12 text-gray-400">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando transaÃ§Ãµes...
                    </div>
                  ) : monthDetail ? (
                    <div className="p-6 space-y-6">
                      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">Centro do lote</p>
                              <h3 className="mt-2 text-lg font-semibold">{monthDetail.statement.label}</h3>
                              <p className="mt-1 text-sm text-slate-300">{monthDetail.statement.bankName}</p>
                            </div>
                            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
                              {monthDetail.statement.transactions.length} transacoes
                            </span>
                          </div>
                          <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                              <p className="text-[11px] text-slate-300">Entradas</p>
                              <p className="mt-1 font-semibold text-emerald-300">{formatCurrency(monthDetail.statement.totalReceitas)}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                              <p className="text-[11px] text-slate-300">Saidas</p>
                              <p className="mt-1 font-semibold text-rose-300">{formatCurrency(monthDetail.statement.totalDespesas)}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                              <p className="text-[11px] text-slate-300">Saldo</p>
                              <p className={cn("mt-1 font-semibold", monthDetail.statement.saldo >= 0 ? "text-emerald-300" : "text-rose-300")}>
                                {formatCurrency(monthDetail.statement.saldo)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Operacao</p>
                              <h3 className="mt-2 text-sm font-semibold text-gray-900">Qualidade da classificacao</h3>
                              <p className="mt-1 text-xs text-gray-500">Resumo do que ainda depende de acao humana neste mes.</p>
                            </div>
                            <span className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                              monthDetail.statement.transactions.some((tx) => tx.needsReview)
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-700"
                            )}>
                              {monthDetail.statement.transactions.filter((tx) => tx.needsReview).length} revisar
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                            <div className="rounded-lg bg-white p-3">
                              <p className="text-[11px] text-gray-500">Conciliadas</p>
                              <p className="mt-1 font-semibold text-emerald-700">
                                {monthDetail.statement.transactions.filter((tx) => tx.processingStatus === "RECONCILED").length}
                              </p>
                            </div>
                            <div className="rounded-lg bg-white p-3">
                              <p className="text-[11px] text-gray-500">Revisadas</p>
                              <p className="mt-1 font-semibold text-blue-700">
                                {monthDetail.statement.transactions.filter((tx) => tx.processingStatus === "CLASSIFIED_MANUAL").length}
                              </p>
                            </div>
                            <div className="rounded-lg bg-white p-3">
                              <p className="text-[11px] text-gray-500">Automaticas</p>
                              <p className="mt-1 font-semibold text-gray-900">
                                {monthDetail.statement.transactions.filter((tx) => tx.processingStatus === "CLASSIFIED_AUTO").length}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {canClearAllStatements && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleClearStatements({ monthKey: month.monthKey })}
                            disabled={cleanupLoading}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                          >
                            {cleanupLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            Apagar este mÃªs
                          </button>
                        </div>
                      )}
                      {/* â”€â”€ Resumo por categoria â”€â”€ */}
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
                                <p className="text-xs text-gray-400">{cat.count} lanÃ§amento(s)</p>
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

                      {/* â”€â”€ Filtros das transaÃ§Ãµes â”€â”€ */}
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-md">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Buscar por descriÃ§Ã£o..."
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
                          {filteredTransactions.length} de {monthDetail.statement.transactions.length} transaÃ§Ãµes
                        </p>
                      </div>

                      {/* â”€â”€ Tabela de transaÃ§Ãµes â”€â”€ */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                              <tr>
                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Data</th>
                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">DescriÃ§Ã£o</th>
                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Tipo</th>
                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Categoria</th>
                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Acoes</th>
                                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Valor</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {filteredTransactions.map((tx) => {
                                const statusMeta = getStatusMeta(tx.processingStatus);
                                const isActing = transactionActionId?.startsWith(`${tx.id}:`);

                                return (
                                <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                                    {formatDate(tx.date)}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <p className="text-gray-900 text-xs truncate max-w-[300px]">{tx.description}</p>
                                    <p className="text-[10px] text-gray-400 truncate max-w-[300px]">
                                      {tx.sourceFile ? `${tx.sourceFile} Â· ` : ""}{tx.importBatchId ? `lote ${tx.importBatchId}` : tx.matchedRule}
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
                                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", statusMeta.tone)}>
                                        {statusMeta.label}
                                      </span>
                                      {tx.statusReason && (
                                        <p className="max-w-[180px] truncate text-[10px] text-gray-400">{tx.statusReason}</p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                      {!tx.isReconciled && tx.processingStatus !== "IGNORED" && (
                                        <button
                                          onClick={() => openReconcile(month.monthKey, tx)}
                                          disabled={Boolean(isActing)}
                                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                                        >
                                          {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                          Vincular
                                        </button>
                                      )}
                                      {!tx.isReconciled && tx.processingStatus !== "IGNORED" && (
                                        <button
                                          onClick={() => applyTransactionAction(month.monthKey, tx.id, "ignore")}
                                          disabled={Boolean(isActing)}
                                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                        >
                                          {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                                          Ignorar
                                        </button>
                                      )}
                                      {!tx.isReconciled && (tx.processingStatus === "IGNORED" || tx.processingStatus === "REVERSED") && (
                                        <button
                                          onClick={() => applyTransactionAction(month.monthKey, tx.id, "restore")}
                                          disabled={Boolean(isActing)}
                                          className="inline-flex items-center gap-1 rounded-md border border-orange-200 px-2 py-1 text-[10px] font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                                        >
                                          {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                                          Reabrir
                                        </button>
                                      )}
                                      {tx.isReconciled && (
                                        <button
                                          onClick={() => applyTransactionAction(month.monthKey, tx.id, "unreconcile")}
                                          disabled={Boolean(isActing)}
                                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                        >
                                          {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                                          Desfazer
                                        </button>
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
                              )})}
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

      {rulesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Regras de classificacao</h2>
                <p className="text-xs text-gray-500">Governanca de prioridade, match e cobertura automatica.</p>
              </div>
              <button onClick={() => setRulesOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-6 p-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Nova regra</h3>
                  <p className="text-xs text-gray-500">Use isso para reduzir fallback e padronizar extratos recorrentes.</p>
                </div>
                <input value={ruleForm.pattern} onChange={(e) => setRuleForm((c) => ({ ...c, pattern: e.target.value }))} placeholder="Padrao do historico" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={ruleForm.kind} onChange={(e) => setRuleForm((c) => ({ ...c, kind: e.target.value as "receita" | "despesa" }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    <option value="despesa">Despesa</option>
                    <option value="receita">Receita</option>
                  </select>
                  <select value={ruleForm.matchMode} onChange={(e) => setRuleForm((c) => ({ ...c, matchMode: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    <option value="CONTAINS">Contem</option>
                    <option value="STARTS_WITH">Comeca com</option>
                    <option value="ENDS_WITH">Termina com</option>
                    <option value="EXACT">Exata</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={ruleForm.categoryLabel} onChange={(e) => setRuleForm((c) => ({ ...c, categoryLabel: e.target.value }))} placeholder="Categoria exibida" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  <input value={ruleForm.priority} onChange={(e) => setRuleForm((c) => ({ ...c, priority: e.target.value }))} placeholder="Prioridade" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                {ruleForm.kind === "despesa" && (
                  <select value={ruleForm.categoryId} onChange={(e) => setRuleForm((c) => ({ ...c, categoryId: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    <option value="">Categoria de despesa vinculada</option>
                    {ruleCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                )}
                <select value={ruleForm.scopeBankAccountId} onChange={(e) => setRuleForm((c) => ({ ...c, scopeBankAccountId: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Todas as contas</option>
                  {ruleAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.bank_name} - {account.account_number}</option>
                  ))}
                </select>
                <button onClick={saveRule} disabled={rulesSaving || !ruleForm.pattern || !ruleForm.categoryLabel} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {rulesSaving ? "Salvando..." : "Salvar regra"}
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Regras ativas</h3>
                    <p className="text-xs text-gray-500">A menor prioridade roda primeiro. Use count mostra impacto real.</p>
                  </div>
                  <button onClick={loadRules} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">Atualizar</button>
                </div>
                <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
                  {rulesLoading ? (
                    <div className="flex items-center justify-center py-12 text-sm text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando regras...</div>
                  ) : rules.map((rule) => (
                    <div key={rule.id} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", rule.kind === "receita" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700")}>{rule.kind}</span>
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">prioridade {rule.priority}</span>
                            {!rule.is_active && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">inativa</span>}
                          </div>
                          <p className="mt-2 text-sm font-medium text-gray-900">{rule.pattern}</p>
                          <p className="mt-1 text-xs text-gray-500">{rule.category_label} · {rule.match_mode} · {rule.use_count} uso(s)</p>
                        </div>
                        <button onClick={() => toggleRuleActive(rule)} className={cn("rounded-lg px-3 py-2 text-xs font-medium", rule.is_active ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100")}>
                          {rule.is_active ? "Desativar" : "Ativar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {auditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Auditoria do modulo</h2>
                <p className="text-xs text-gray-500">Historico de importacao, revisao, regras e conciliacao bancaria.</p>
              </div>
              <button onClick={() => setAuditOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[620px] overflow-y-auto p-6">
              {auditLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando auditoria...</div>
              ) : (
                <div className="space-y-3">
                  {auditEvents.map((event) => (
                    <div key={event.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{event.summary}</p>
                          <p className="mt-1 text-xs text-gray-500">{event.entityType} · {event.entityLabel}</p>
                        </div>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", event.severity === "CRITICAL" ? "bg-rose-100 text-rose-700" : event.severity === "WARN" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700")}>{event.severity}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                        <span>{event.actor} · {event.action}</span>
                        <span>{formatDate(event.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {reconcileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Conciliacao manual</h2>
                <p className="text-xs text-gray-500">Vincule esta transacao a um lancamento financeiro existente.</p>
              </div>
              <button onClick={() => setReconcileModal(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-900">{reconcileModal.tx.description}</p>
                <p className="mt-1 text-xs text-gray-500">{formatDate(reconcileModal.tx.date)} · {reconcileModal.tx.isCredit ? "Receita" : "Despesa"} · {formatCurrency(reconcileModal.tx.amount)}</p>
              </div>
              {reconcileLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando candidatos...</div>
              ) : (
                <div className="space-y-3">
                  {reconcileCandidates.map((candidate) => {
                    const exact = Math.abs(candidate.amount - reconcileModal.tx.amount) < 0.001;
                    return (
                      <label key={candidate.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4", selectedReconcileCandidate === candidate.id ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white")}>
                        <input type="radio" name="reconcile-candidate" checked={selectedReconcileCandidate === candidate.id} onChange={() => setSelectedReconcileCandidate(candidate.id)} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{candidate.label}</p>
                            {exact && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">valor exato</span>}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">{formatDate(candidate.date)} · {formatCurrency(candidate.amount)} · {candidate.kind}</p>
                        </div>
                      </label>
                    );
                  })}
                  {reconcileCandidates.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">Nenhum lancamento encontrado neste periodo. Cadastre o financeiro primeiro ou mantenha esta linha em revisao.</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setReconcileModal(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmManualReconcile} disabled={!selectedReconcileCandidate || reconcileSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {reconcileSaving ? "Conciliando..." : "Confirmar vinculacao"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MODAL DE UPLOAD
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Importar Extrato</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Arquivo OFX ou CSV da Caixa EconÃ´mica Federal
                </p>
              </div>
              <button onClick={() => { setShowUpload(false); setImportPreview(null); setSelectedFile(null); }} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ConteÃºdo */}
            <div className="p-6 space-y-4">
              {uploadSuccess ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700">
                  <ArrowUpCircle className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{uploadSuccess}</p>
                    <p className="text-xs mt-1 text-green-600">
                      As transaÃ§Ãµes foram categorizadas automaticamente e gravadas no financeiro. Feche este modal para ver.
                    </p>
                  </div>
                </div>
              ) : importPreview ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">PrÃ©via pronta para confirmar</p>
                    <p className="mt-1 text-xs text-blue-700">
                      {importPreview.bankName} Â· {importPreview.transactionCount} transaÃ§Ã£o(Ãµes) Â· {importPreview.months.join(", ")}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-gray-500">Entradas</p>
                        <p className="font-bold text-green-700">{formatCurrency(importPreview.totalReceitas)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-gray-500">SaÃ­das</p>
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
                          <th className="px-3 py-2 text-left">DescriÃ§Ã£o</th>
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
                                {row.duplicate ? "duplicata" : row.existingFinancialType ? "conciliÃ¡vel" : row.matchedRule}
                              </p>
                            </td>
                            <td className="px-3 py-2">
                              <span className={cn("rounded px-1.5 py-0.5", row.needsReview ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700")}>
                                {row.category} Â· {row.confidence}%
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
                    <p className="text-xs text-gray-400 mt-1">OFX, CSV, XLSX ou TXT Â· Caixa EconÃ´mica Federal</p>
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

