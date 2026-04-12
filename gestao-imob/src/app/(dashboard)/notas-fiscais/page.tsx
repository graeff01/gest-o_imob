"use client";

/**
 * Página de Notas Fiscais (NFS-e)
 * --------------------------------
 * Funcionalidades:
 *   - Listagem de notas com filtros e busca (dados reais do banco)
 *   - Import do Excel exportado do DW com preview antes de confirmar
 *   - Emissão de NFS-e via gateway com modal de confirmação
 *   - Tracking de status (PENDENTE → PROCESSANDO → EMITIDA → ENVIADA → PAGA)
 *   - Download do PDF da nota emitida
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, Search, Send, CheckCircle2, Clock, Ban,
  DollarSign, Upload, AlertCircle, X, RefreshCw,
  Download, ChevronDown, ChevronUp, Loader2, AlertTriangle,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type InvoiceStatus =
  | "PENDENTE"
  | "PROCESSANDO"
  | "EMITIDA"
  | "ENVIADA"
  | "PAGA"
  | "CANCELADA"
  | "ERRO";

type ServiceType = "INTERMEDIACAO" | "AGENCIAMENTO" | "ADMINISTRACAO";

interface Invoice {
  id: string;
  nfse_number: number | null;
  year_sequence: number | null;
  reference_year: number;
  reference_month: number | null;
  client_name: string;
  client_cpf_cnpj: string;
  client_contact: string | null;
  property_code: string | null;
  property_address: string | null;
  service_type: ServiceType;
  title_number: string | null;
  amount: number;
  description_title: string;
  description_body: string;
  status: InvoiceStatus;
  issued_at: string | null;
  sent_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  gateway_id: string | null;
  gateway_pdf_url: string | null;
  gateway_status: string | null;
  last_emit_error: string | null;
  emit_attempts: number;
  imported_from_dw: boolean;
  dw_agency_name: string | null;
  notes: string | null;
  due_date: string | null;
  created_at: string;
}

interface Summary {
  total: number;
  pendentes: number;
  emitidas: number;
  enviadas: number;
  pagas: number;
  canceladas: number;
  totalAmount: number;
}

interface PreviewRow {
  rowIndex: number;
  title_number: string;
  client_name: string;
  client_cpf_cnpj: string;
  property_address: string | null;
  service_type: string;
  amount: number;
  due_date: string;
  reference_month: number;
  reference_year: number;
  description_title: string;
  description_body: string;
  agency_name: string;
  dw_status: string;
  import_status: "nova" | "duplicata";
}

interface ParseError {
  rowIndex: number;
  message: string;
}

// ─── Configurações de UI ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDENTE:    { label: "Pendente",     color: "bg-amber-50 text-amber-700 border-amber-200",   icon: Clock },
  PROCESSANDO: { label: "Processando",  color: "bg-blue-50 text-blue-600 border-blue-200",      icon: Loader2 },
  EMITIDA:     { label: "Emitida",      color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: FileText },
  ENVIADA:     { label: "Enviada",      color: "bg-purple-50 text-purple-700 border-purple-200", icon: Send },
  PAGA:        { label: "Paga",         color: "bg-green-50 text-green-700 border-green-200",    icon: CheckCircle2 },
  CANCELADA:   { label: "Cancelada",    color: "bg-gray-50 text-gray-500 border-gray-200",       icon: Ban },
  ERRO:        { label: "Erro",         color: "bg-red-50 text-red-700 border-red-200",          icon: AlertCircle },
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  INTERMEDIACAO: "Intermediação",
  AGENCIAMENTO:  "Agenciamento",
  ADMINISTRACAO: "Administração",
};

const MONTH_NAMES = [
  "Jan","Fev","Mar","Abr","Mai","Jun",
  "Jul","Ago","Set","Out","Nov","Dez",
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NotasFiscaisPage() {
  // ── Estado principal ──
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filtros ──
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterService, setFilterService] = useState("");
  const [activeTab, setActiveTab] = useState<"todas" | "pendentes" | "erro">("todas");

  // ── Expandir linha ──
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Modal de emissão ──
  const [emitModal, setEmitModal] = useState<Invoice | null>(null);
  const [emitting, setEmitting] = useState(false);
  const [emitError, setEmitError] = useState<string | null>(null);

  // ── Modal de import DW ──
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<PreviewRow[] | null>(null);
  const [importSummary, setImportSummary] = useState<Record<string, number> | null>(null);
  const [importErrors, setImportErrors] = useState<ParseError[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Carregar dados ──
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (search) params.set("search", search);
      if (filterService) params.set("service_type", filterService);

      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar notas fiscais.");
      const data = await res.json();
      setInvoices(data.invoices ?? []);
      setSummary(data.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterService, search]);

  useEffect(() => {
    const timer = setTimeout(fetchInvoices, 300); // debounce na busca
    return () => clearTimeout(timer);
  }, [fetchInvoices]);

  // ── Filtro local por tab ──
  const filtered = invoices.filter((inv) => {
    if (activeTab === "pendentes" && inv.status !== "PENDENTE") return false;
    if (activeTab === "erro" && inv.status !== "ERRO") return false;
    return true;
  });

  // ── Atualizar status manualmente (Enviada / Paga / Cancelada) ──
  const updateStatus = async (id: string, newStatus: InvoiceStatus) => {
    const now = new Date().toISOString();
    const data: Record<string, unknown> = { status: newStatus };
    if (newStatus === "ENVIADA") data.sent_at = now;
    if (newStatus === "PAGA")    data.paid_at = now;
    if (newStatus === "CANCELADA") data.cancelled_at = now;

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao atualizar status.");
      await fetchInvoices();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar.");
    }
  };

  // ── Emissão via gateway ──
  const handleEmit = async () => {
    if (!emitModal) return;
    setEmitting(true);
    setEmitError(null);

    try {
      const res = await fetch(`/api/invoices/${emitModal.id}/emit`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setEmitError(data.error ?? data.details ?? "Falha ao emitir. Tente novamente.");
        return;
      }

      // Sucesso — fecha modal e recarrega
      setEmitModal(null);
      await fetchInvoices();
    } catch {
      setEmitError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setEmitting(false);
    }
  };

  // ── Import DW: parse do arquivo (preview) ──
  const handleFileSelect = async (file: File) => {
    setImportFile(file);
    setImportPreview(null);
    setImportErrors([]);
    setImportSuccess(null);
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Sem ?confirm — retorna apenas preview
      const res = await fetch("/api/invoices/import-dw", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setImportErrors(data.parseErrors ?? [{ rowIndex: 0, message: data.error }]);
        return;
      }

      setImportPreview(data.preview ?? []);
      setImportSummary(data.summary ?? null);
      setImportErrors(data.parseErrors ?? []);
    } catch {
      setImportErrors([{ rowIndex: 0, message: "Erro ao ler o arquivo. Tente novamente." }]);
    } finally {
      setImporting(false);
    }
  };

  // ── Import DW: confirma e persiste ──
  const handleImportConfirm = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      // Com ?confirm=true — persiste no banco
      const res = await fetch("/api/invoices/import-dw?confirm=true", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setImportErrors([{ rowIndex: 0, message: data.error ?? "Erro ao importar." }]);
        return;
      }

      setImportSuccess(data.message);
      setImportPreview(null);
      setImportFile(null);
      await fetchInvoices();
    } catch {
      setImportErrors([{ rowIndex: 0, message: "Erro de conexão ao importar." }]);
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportPreview(null);
    setImportSummary(null);
    setImportErrors([]);
    setImportSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Cálculos para os cards de resumo ──
  const totalPendente = invoices.filter((i) => i.status === "PENDENTE").reduce((s, i) => s + Number(i.amount), 0);
  const totalEmitido  = invoices.filter((i) => ["EMITIDA","ENVIADA"].includes(i.status)).reduce((s, i) => s + Number(i.amount), 0);
  const totalPago     = invoices.filter((i) => i.status === "PAGA").reduce((s, i) => s + Number(i.amount), 0);
  const totalErro     = invoices.filter((i) => i.status === "ERRO").length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notas Fiscais</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Importação do DW, emissão de NFS-e e controle de ciclo de vida.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchInvoices}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setImportModal(true); resetImport(); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Importar DW
          </button>
        </div>
      </div>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">A Emitir</p>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(totalPendente)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{summary?.pendentes ?? 0} nota(s)</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Em Trânsito</p>
          <p className="text-xl font-bold text-indigo-700">{formatCurrency(totalEmitido)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{(summary?.emitidas ?? 0) + (summary?.enviadas ?? 0)} nota(s)</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Recebido</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalPago)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{summary?.pagas ?? 0} nota(s)</p>
        </div>
        <div className={cn(
          "bg-white p-4 rounded-xl border transition-colors",
          totalErro > 0 ? "border-red-200 bg-red-50" : "border-gray-200"
        )}>
          <p className={cn("text-xs mb-1", totalErro > 0 ? "text-red-500" : "text-gray-500")}>Com Erro</p>
          <p className={cn("text-xl font-bold", totalErro > 0 ? "text-red-700" : "text-gray-400")}>
            {totalErro}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">requer atenção</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { id: "todas",     label: `Todas (${invoices.length})` },
          { id: "pendentes", label: `Pendentes (${summary?.pendentes ?? 0})` },
          { id: "erro",      label: `Erros (${totalErro})`, alert: totalErro > 0 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
            {tab.alert && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
          </button>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, CPF/CNPJ, endereço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {activeTab === "todas" && (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        )}
        <select
          value={filterService}
          onChange={(e) => setFilterService(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Todos os serviços</option>
          {Object.entries(SERVICE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* ── Tabela ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Carregando notas fiscais...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-red-500 gap-2">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Serviço</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Competência</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Ações</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-gray-400">
                      <FileText className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                      Nenhuma nota fiscal encontrada.
                    </td>
                  </tr>
                ) : filtered.map((inv) => {
                  const st = STATUS_CONFIG[inv.status];
                  const StatusIcon = st.icon;
                  const isExpanded = expandedId === inv.id;

                  return (
                    <>
                      <tr key={inv.id} className={cn(
                        "group hover:bg-gray-50 transition-colors",
                        inv.status === "ERRO" && "bg-red-50/30"
                      )}>
                        {/* # */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            {inv.nfse_number ? (
                              <span className="text-xs font-mono text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                                NFS-e {inv.nfse_number}
                              </span>
                            ) : inv.year_sequence ? (
                              <span className="text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                NF-{inv.reference_year}-{String(inv.year_sequence).padStart(3, "0")}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                            {inv.imported_from_dw && (
                              <span className="text-[10px] text-gray-400">DW</span>
                            )}
                          </div>
                        </td>

                        {/* Cliente */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 truncate max-w-[180px]">{inv.client_name}</p>
                          <p className="text-xs text-gray-400">{inv.client_cpf_cnpj}</p>
                        </td>

                        {/* Serviço */}
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                            {SERVICE_LABELS[inv.service_type]}
                          </span>
                        </td>

                        {/* Competência */}
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {inv.reference_month
                            ? `${MONTH_NAMES[inv.reference_month - 1]}/${inv.reference_year}`
                            : inv.reference_year}
                        </td>

                        {/* Valor */}
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                          {formatCurrency(Number(inv.amount))}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                            st.color
                          )}>
                            <StatusIcon className={cn(
                              "h-3 w-3",
                              inv.status === "PROCESSANDO" && "animate-spin"
                            )} />
                            {st.label}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">

                            {/* Emitir — PENDENTE ou ERRO */}
                            {(inv.status === "PENDENTE" || inv.status === "ERRO") && (
                              <button
                                onClick={() => { setEmitModal(inv); setEmitError(null); }}
                                className="p-1.5 border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Emitir NFS-e"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Marcar como Enviada — EMITIDA */}
                            {inv.status === "EMITIDA" && (
                              <button
                                onClick={() => updateStatus(inv.id, "ENVIADA")}
                                className="p-1.5 border border-purple-200 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors"
                                title="Marcar como enviada ao cliente"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Marcar como Paga — EMITIDA ou ENVIADA */}
                            {(inv.status === "EMITIDA" || inv.status === "ENVIADA") && (
                              <button
                                onClick={() => updateStatus(inv.id, "PAGA")}
                                className="p-1.5 border border-green-200 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                                title="Marcar como paga"
                              >
                                <DollarSign className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Download PDF — se tiver */}
                            {inv.gateway_pdf_url && (
                              <a
                                href={inv.gateway_pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                                title="Baixar PDF da NFS-e"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )}

                            {/* Cancelar — status não terminais */}
                            {!["CANCELADA", "PAGA", "PROCESSANDO"].includes(inv.status) && (
                              <button
                                onClick={() => {
                                  if (confirm(`Cancelar a nota de ${inv.client_name}? Esta ação não pode ser desfeita.`)) {
                                    updateStatus(inv.id, "CANCELADA");
                                  }
                                }}
                                className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                                title="Cancelar nota"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Expandir */}
                        <td className="px-2 py-3">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                          >
                            {isExpanded
                              ? <ChevronUp className="h-4 w-4" />
                              : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Linha expandida com detalhes */}
                      {isExpanded && (
                        <tr key={`${inv.id}-detail`} className="bg-gray-50/80">
                          <td colSpan={8} className="px-6 py-4 border-t border-gray-100">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-3">
                              <div>
                                <p className="text-gray-400 mb-0.5">Imóvel</p>
                                <p className="font-medium text-gray-700">{inv.property_address || `Cód. ${inv.property_code}` || "—"}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-0.5">Título DW</p>
                                <p className="font-mono text-gray-700">{inv.title_number || "—"}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-0.5">Vencimento DW</p>
                                <p className="font-medium text-gray-700">{inv.due_date ? formatDate(inv.due_date) : "—"}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-0.5">Agência</p>
                                <p className="font-medium text-gray-700">{inv.dw_agency_name || "—"}</p>
                              </div>
                            </div>

                            <div className="text-xs mb-2">
                              <p className="text-gray-400 mb-0.5">Descrição da NFS-e</p>
                              <p className="text-gray-600 leading-relaxed">{inv.description_body}</p>
                            </div>

                            {inv.last_emit_error && (
                              <div className="text-xs bg-red-50 border border-red-100 rounded-lg p-2 mb-2">
                                <p className="text-red-500 font-medium mb-0.5">Erro na última tentativa de emissão:</p>
                                <p className="text-red-600 font-mono">{inv.last_emit_error}</p>
                              </div>
                            )}

                            {inv.gateway_id && (
                              <div className="text-xs text-gray-400">
                                Gateway ID: <span className="font-mono text-gray-600">{inv.gateway_id}</span>
                                {inv.emit_attempts > 0 && ` · ${inv.emit_attempts} tentativa(s)`}
                              </div>
                            )}

                            <div className="mt-2 flex gap-4 text-xs">
                              {inv.issued_at && (
                                <p className="text-gray-400">
                                  Emitida: <span className="text-gray-700">{formatDate(inv.issued_at)}</span>
                                </p>
                              )}
                              {inv.sent_at && (
                                <p className="text-gray-400">
                                  Enviada: <span className="text-gray-700">{formatDate(inv.sent_at)}</span>
                                </p>
                              )}
                              {inv.paid_at && (
                                <p className="text-gray-400">
                                  Paga: <span className="text-green-700 font-medium">{formatDate(inv.paid_at)}</span>
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL DE EMISSÃO
      ═══════════════════════════════════════════════════════════════════ */}
      {emitModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Emitir NFS-e</h2>
                <p className="text-xs text-gray-500 mt-0.5">Revise os dados antes de emitir. Esta ação é irreversível.</p>
              </div>
              <button onClick={() => setEmitModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Dados da nota */}
            <div className="p-6 space-y-4">

              {/* Alerta de modo stub */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Modo de desenvolvimento ativo</p>
                  <p className="mt-0.5">A nota será marcada como emitida no sistema, mas <strong>não será enviada à prefeitura</strong> até o gateway ser configurado com o certificado digital.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Tomador (quem recebe)</p>
                  <p className="font-medium text-gray-900">{emitModal.client_name}</p>
                  <p className="text-xs text-gray-500">{emitModal.client_cpf_cnpj}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Valor do serviço</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(Number(emitModal.amount))}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Tipo de serviço</p>
                  <p className="font-medium text-gray-900">{SERVICE_LABELS[emitModal.service_type]}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Competência</p>
                  <p className="font-medium text-gray-900">
                    {emitModal.reference_month
                      ? `${MONTH_NAMES[emitModal.reference_month - 1]}/${emitModal.reference_year}`
                      : emitModal.reference_year}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-xs text-gray-400 mb-1">Descrição que irá na NFS-e</p>
                <p className="text-gray-700 leading-relaxed">{emitModal.description_body}</p>
              </div>

              {emitModal.property_address && (
                <div className="text-xs text-gray-500">
                  Imóvel: {emitModal.property_address}
                </div>
              )}

              {emitModal.emit_attempts > 0 && (
                <p className="text-xs text-gray-400">
                  Tentativas anteriores: {emitModal.emit_attempts}
                </p>
              )}

              {/* Erro da tentativa atual */}
              {emitError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>{emitError}</p>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setEmitModal(null)}
                disabled={emitting}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEmit}
                disabled={emitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {emitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Emitindo...</>
                ) : (
                  <><FileText className="h-4 w-4" /> Confirmar Emissão</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL DE IMPORT DW
      ═══════════════════════════════════════════════════════════════════ */}
      {importModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Importar Notas do DW</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Selecione o arquivo Excel exportado do DW da Auxiliadora Predial.
                </p>
              </div>
              <button onClick={() => setImportModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo scrollável */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* Sucesso */}
              {importSuccess && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{importSuccess}</p>
                </div>
              )}

              {/* Área de upload */}
              {!importPreview && !importSuccess && (
                <label className={cn(
                  "flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors",
                  importing
                    ? "border-blue-300 bg-blue-50 cursor-not-allowed"
                    : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                )}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={importing}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                    }}
                  />
                  {importing ? (
                    <Loader2 className="h-8 w-8 text-blue-400 animate-spin mb-2" />
                  ) : (
                    <Upload className="h-8 w-8 text-gray-300 mb-2" />
                  )}
                  <p className="text-sm font-medium text-gray-700">
                    {importing ? "Lendo arquivo..." : "Clique ou arraste o arquivo Excel do DW"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Apenas .xlsx ou .xls · Máximo 10MB</p>
                  <a
                    href="/api/invoices/sample-dw"
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 text-xs text-blue-500 hover:text-blue-700 underline underline-offset-2"
                  >
                    Baixar planilha de exemplo
                  </a>
                </label>
              )}

              {/* Erros de parse */}
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm font-medium text-red-700">
                      {importErrors.length} linha(s) com problema
                    </p>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {importErrors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600">
                        {e.rowIndex > 0 ? `Linha ${e.rowIndex}: ` : ""}{e.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {importPreview && importSummary && (
                <div className="space-y-3">

                  {/* Resumo do import */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Total lido",  value: importSummary.totalRows,    color: "text-gray-900" },
                      { label: "Novas",       value: importSummary.newRows,      color: "text-green-700" },
                      { label: "Duplicatas",  value: importSummary.duplicateRows, color: "text-amber-700" },
                      { label: "Erros",       value: importSummary.errorRows,    color: "text-red-700" },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-400">{item.label}</p>
                        <p className={cn("text-lg font-bold", item.color)}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {importSummary.newRows === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 text-center">
                      Todas as notas deste arquivo já foram importadas anteriormente.
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      {importSummary.newRows} nota(s) nova(s) serão importadas.
                      Duplicatas (título já existente) serão ignoradas.
                    </p>
                  )}

                  {/* Tabela de preview */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Titular</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Tipo</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Vencimento</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-500">Valor</th>
                          <th className="text-center px-3 py-2 font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importPreview.map((row) => (
                          <tr key={row.rowIndex} className={cn(
                            row.import_status === "duplicata" && "opacity-50 bg-gray-50"
                          )}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-800 truncate max-w-[160px]">{row.client_name}</p>
                              <p className="text-gray-400">{row.client_cpf_cnpj}</p>
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {SERVICE_LABELS[row.service_type as ServiceType] ?? row.service_type}
                            </td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                              {row.due_date}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800 whitespace-nowrap">
                              {formatCurrency(row.amount)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {row.import_status === "nova" ? (
                                <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-medium">Nova</span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">Duplicata</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé com ações */}
            <div className="flex items-center justify-between p-6 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={resetImport}
                disabled={importing}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                {importPreview ? "Escolher outro arquivo" : "Limpar"}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setImportModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Fechar
                </button>
                {importPreview && (importSummary?.newRows ?? 0) > 0 && (
                  <button
                    onClick={handleImportConfirm}
                    disabled={importing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {importing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
                    ) : (
                      <><Upload className="h-4 w-4" /> Importar {importSummary?.newRows} nota(s)</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
