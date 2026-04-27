"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, Search, Send, CheckCircle2, Clock, Ban,
  DollarSign, Upload, AlertCircle, X, RefreshCw,
  Download, ChevronDown, ChevronUp, Loader2, AlertTriangle, Info,
  Plus, Square, CheckSquare, FileSpreadsheet, Zap,
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn, formatCurrency, formatDate, maskSensitiveCpfCnpj } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type InvoiceStatus =
  | "PENDENTE" | "PROCESSANDO" | "EMITIDA"
  | "ENVIADA"  | "PAGA"        | "CANCELADA" | "ERRO";

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
  gateway_provider: string | null;
  gateway_pdf_url: string | null;
  gateway_xml_url: string | null;
  gateway_status: string | null;
  last_emit_error: string | null;
  last_emit_at: string | null;
  emit_attempts: number;
  imported_from_dw: boolean;
  dw_agency_name: string | null;
  notes: string | null;
  due_date: string | null;
  created_at: string;
}

interface Summary {
  total: number; pendentes: number; emitidas: number;
  enviadas: number; pagas: number; canceladas: number; totalAmount: number;
}

interface PreviewRow {
  rowIndex: number; title_number: string; client_name: string;
  client_cpf_cnpj: string; property_address: string | null;
  service_type: string; amount: number; due_date: string;
  reference_month: number; reference_year: number;
  description_title: string; description_body: string;
  agency_name: string; dw_status: string;
  import_status: "nova" | "duplicata";
}

interface ParseError { rowIndex: number; message: string; }

interface ManualForm {
  client_name: string; client_cpf_cnpj: string; client_contact: string;
  property_code: string; property_address: string;
  service_type: ServiceType | ""; amount: string;
  reference_month: string; reference_year: string;
  due_date: string; notes: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDENTE:    { label: "Pendente",    color: "bg-amber-50 text-amber-700 border-amber-200",    icon: Clock },
  PROCESSANDO: { label: "Processando", color: "bg-blue-50 text-blue-600 border-blue-200",       icon: Loader2 },
  EMITIDA:     { label: "Emitida",     color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: FileText },
  ENVIADA:     { label: "Enviada",     color: "bg-purple-50 text-purple-700 border-purple-200", icon: Send },
  PAGA:        { label: "Paga",        color: "bg-green-50 text-green-700 border-green-200",    icon: CheckCircle2 },
  CANCELADA:   { label: "Cancelada",   color: "bg-gray-50 text-gray-500 border-gray-200",       icon: Ban },
  ERRO:        { label: "Erro",        color: "bg-red-50 text-red-700 border-red-200",          icon: AlertCircle },
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  INTERMEDIACAO: "Intermediação",
  AGENCIAMENTO:  "Agenciamento",
  ADMINISTRACAO: "Administração",
};

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const EMPTY_MANUAL_FORM: ManualForm = {
  client_name: "", client_cpf_cnpj: "", client_contact: "",
  property_code: "", property_address: "",
  service_type: "", amount: "",
  reference_month: String(new Date().getMonth() + 1),
  reference_year: String(new Date().getFullYear()),
  due_date: "", notes: "",
};

// ─── Helper: gera descrição para nota manual ──────────────────────────────────

function buildManualDescription(
  serviceType: string, propertyAddress: string, propertyCode: string,
  month: number, year: number, clientName: string, amount: number,
): { title: string; body: string } {
  const serviceLabel = SERVICE_LABELS[serviceType as ServiceType] ?? serviceType;
  const monthName = MONTH_NAMES[month - 1] ?? "";
  const ref = propertyAddress || (propertyCode ? `código ${propertyCode}` : "");
  const title = `${serviceLabel} - ${monthName}/${year}`;
  const body = [
    `Prestação de serviço de ${serviceLabel.toLowerCase()}`,
    ref ? `referente ao imóvel ${ref}` : "",
    `para ${clientName}.`,
    `Competência: ${monthName}/${year}.`,
    `Valor: ${formatCurrency(amount)}.`,
  ].filter(Boolean).join(" ");
  return { title, body };
}

function invoiceCode(inv: Invoice) {
  if (inv.nfse_number) return `NFS-e ${inv.nfse_number}`;
  if (inv.year_sequence) return `NF-${inv.reference_year}-${String(inv.year_sequence).padStart(3, "0")}`;
  return "Nota sem sequencia";
}

function explainEmitError(raw?: string | null) {
  const text = raw || "Falha nao detalhada pelo gateway.";
  const lower = text.toLowerCase();

  if (lower.includes("credenciais") || lower.includes("api_key") || lower.includes("401") || lower.includes("403")) {
    return {
      title: "Credenciais do gateway nao configuradas ou recusadas.",
      action: "Validar NFSE_GATEWAY_API_KEY, NFSE_COMPANY_ID e permissao da empresa no NFS.io.",
    };
  }

  if (lower.includes("conectar") || lower.includes("timeout") || lower.includes("network") || lower.includes("fetch")) {
    return {
      title: "Nao foi possivel conectar ao gateway.",
      action: "Tentar novamente e verificar se o gateway esta disponivel. Em PRD, acompanhar logs do Railway.",
    };
  }

  if (lower.includes("tomador") || lower.includes("cpf") || lower.includes("cnpj") || lower.includes("borrower")) {
    return {
      title: "Dados do tomador podem estar invalidos.",
      action: "Conferir nome, CPF/CNPJ, contato e endereco antes de reenviar.",
    };
  }

  if (lower.includes("servico") || lower.includes("service") || lower.includes("aliquota") || lower.includes("iss")) {
    return {
      title: "Dados do servico ou tributacao podem estar invalidos.",
      action: "Conferir descricao, valor, aliquota, codigo de servico e configuracao fiscal da empresa.",
    };
  }

  return {
    title: "O gateway recusou a emissao.",
    action: "Ler o detalhe tecnico abaixo, ajustar os dados indicados e reenviar a nota.",
  };
}

function operationMessage(inv: Invoice) {
  if (inv.status === "PENDENTE") return "A nota esta pronta para revisao e emissao.";
  if (inv.status === "PROCESSANDO") return "A emissao foi iniciada e aguarda retorno do gateway.";
  if (inv.status === "ERRO") return "A emissao falhou. Corrija o ponto indicado e tente novamente.";
  if (inv.status === "EMITIDA") return "A nota foi emitida. Proximo passo: enviar ao cliente ou marcar pagamento.";
  if (inv.status === "ENVIADA") return "A nota foi enviada ao cliente e aguarda pagamento.";
  if (inv.status === "PAGA") return "Ciclo concluido: nota emitida, enviada e paga.";
  return "Nota cancelada. Ela fica registrada para rastreabilidade.";
}

function buildInvoiceTimeline(inv: Invoice) {
  const events: Array<{
    label: string;
    date: string | null;
    detail: string;
    tone: "blue" | "green" | "red" | "amber" | "purple" | "gray";
  }> = [
    {
      label: inv.imported_from_dw ? "Importada do DW" : "Criada manualmente",
      date: inv.created_at,
      detail: inv.imported_from_dw
        ? "Entrada criada a partir da planilha do DW."
        : "Entrada criada manualmente no sistema.",
      tone: "blue",
    },
  ];

  if (inv.emit_attempts > 0) {
    events.push({
      label: inv.status === "ERRO" ? "Tentativa de emissao falhou" : "Tentativa de emissao registrada",
      date: inv.last_emit_at,
      detail: `${inv.emit_attempts} tentativa(s) de emissao. Gateway: ${inv.gateway_provider || "stub/local"}.`,
      tone: inv.status === "ERRO" ? "red" : "amber",
    });
  }

  if (inv.issued_at) {
    events.push({
      label: "NFS-e emitida",
      date: inv.issued_at,
      detail: inv.gateway_status ? `Status do gateway: ${inv.gateway_status}.` : "Emissao registrada com sucesso.",
      tone: "green",
    });
  }

  if (inv.sent_at) {
    events.push({ label: "Enviada ao cliente", date: inv.sent_at, detail: "Marcada como enviada.", tone: "purple" });
  }

  if (inv.paid_at) {
    events.push({ label: "Pagamento confirmado", date: inv.paid_at, detail: "Marcada como paga.", tone: "green" });
  }

  if (inv.cancelled_at) {
    events.push({ label: "Nota cancelada", date: inv.cancelled_at, detail: inv.notes || "Cancelamento registrado.", tone: "gray" });
  }

  return events;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NotasFiscaisPage() {

  // ── Estado principal ──
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // ── Filtros ──
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterMonth, setFilterMonth]   = useState("");
  const [filterYear, setFilterYear]     = useState("");
  const [activeTab, setActiveTab]       = useState<"todas" | "pendentes" | "erro" | "vencidas">("todas");

  // ── Expandir linha ──
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Modal de emissão ──
  const [emitModal, setEmitModal]     = useState<Invoice | null>(null);
  const [emitting, setEmitting]       = useState(false);
  const [emitError, setEmitError]     = useState<string | null>(null);
  const [emitCep, setEmitCep]         = useState("");
  const [emitAliquota, setEmitAliquota] = useState("9");
  const [cepLoading, setCepLoading]   = useState(false);
  const [cepResults, setCepResults]   = useState<{ cep_formatted: string; logradouro: string; bairro: string }[]>([]);
  const [showFixedFields, setShowFixedFields] = useState(false);

  // ── Seleção e emissão em lote ──
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [batchEmitting, setBatchEmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  // ── Modal de cancelamento ──
  const [cancelModal, setCancelModal]   = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── Relatório mensal ──
  const [reportModal, setReportModal] = useState(false);
  const [reportMonth, setReportMonth] = useState(String(new Date().getMonth() + 1));
  const [reportYear, setReportYear]   = useState(String(new Date().getFullYear()));

  // ── Modal de nota manual ──
  const [manualModal, setManualModal]   = useState(false);
  const [manualForm, setManualForm]     = useState<ManualForm>(EMPTY_MANUAL_FORM);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError]   = useState<string | null>(null);

  // ── Modal de import DW ──
  const [importModal, setImportModal]     = useState(false);
  const [importFile, setImportFile]       = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<PreviewRow[] | null>(null);
  const [importSummary, setImportSummary] = useState<Record<string, number> | null>(null);
  const [importErrors, setImportErrors]   = useState<ParseError[]>([]);
  const [importing, setImporting]         = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [dwCleanupLoading, setDwCleanupLoading] = useState(false);
  const [dwCleanupMessage, setDwCleanupMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Carregar dados ──
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus)  params.set("status",       filterStatus);
      if (search)        params.set("search",        search);
      if (filterService) params.set("service_type",  filterService);

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
    const timer = setTimeout(fetchInvoices, 300);
    return () => clearTimeout(timer);
  }, [fetchInvoices]);

  // ── Computed ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isOverdue = (inv: Invoice) =>
    !!inv.due_date && new Date(inv.due_date) < today && ["PENDENTE", "ERRO"].includes(inv.status);

  const filtered = invoices.filter((inv) => {
    if (activeTab === "pendentes" && inv.status !== "PENDENTE") return false;
    if (activeTab === "erro"      && inv.status !== "ERRO")     return false;
    if (activeTab === "vencidas"  && !isOverdue(inv))           return false;
    if (filterMonth && inv.reference_month !== Number(filterMonth)) return false;
    if (filterYear  && inv.reference_year  !== Number(filterYear))  return false;
    return true;
  });

  const overdueCount      = invoices.filter(isOverdue).length;
  const pendentesInView   = filtered.filter(i => i.status === "PENDENTE");
  const allSelected       = pendentesInView.length > 0 && pendentesInView.every(i => selectedIds.has(i.id));
  const totalPendente     = invoices.filter(i => i.status === "PENDENTE").reduce((s, i) => s + Number(i.amount), 0);
  const totalEmitido      = invoices.filter(i => ["EMITIDA","ENVIADA"].includes(i.status)).reduce((s, i) => s + Number(i.amount), 0);
  const totalPago         = invoices.filter(i => i.status === "PAGA").reduce((s, i) => s + Number(i.amount), 0);
  const totalErro         = invoices.filter(i => i.status === "ERRO").length;

  // ── Atualizar status ──
  const updateStatus = async (id: string, newStatus: InvoiceStatus) => {
    const now = new Date().toISOString();
    const data: Record<string, unknown> = { status: newStatus };
    if (newStatus === "ENVIADA")   data.sent_at      = now;
    if (newStatus === "PAGA")      data.paid_at      = now;
    if (newStatus === "CANCELADA") data.cancelled_at = now;
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Erro ao atualizar status.");
      await fetchInvoices();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar.");
    }
  };

  // ── Cancelamento com motivo ──
  const handleCancelConfirm = async () => {
    if (!cancelModal) return;
    if (!cancelReason.trim()) {
      alert("Informe um motivo para cancelar a nota.");
      return;
    }
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/invoices/${cancelModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELADA",
          cancelled_at: new Date().toISOString(),
          notes: cancelReason || null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Erro ao cancelar.");
      setCancelModal(null);
      setCancelReason("");
      await fetchInvoices();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao cancelar.");
    } finally {
      setCancelLoading(false);
    }
  };

  // ── Emissão em lote ──
  const handleBatchEmit = async () => {
    const ids = Array.from(selectedIds).filter(id => {
      const inv = invoices.find(i => i.id === id);
      return inv && ["PENDENTE", "ERRO"].includes(inv.status);
    });
    if (ids.length === 0) return;
    setBatchEmitting(true);
    setBatchProgress({ done: 0, total: ids.length });
    for (const id of ids) {
      try {
        await fetch(`/api/invoices/${id}/emit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aliquota: 9 }),
        });
      } catch { /* continua próxima */ }
      setBatchProgress(p => ({ ...p, done: p.done + 1 }));
    }
    setBatchEmitting(false);
    setSelectedIds(new Set());
    await fetchInvoices();
  };

  // ── Exportar Excel ──
  const handleExportExcel = () => {
    const data = filtered.map(inv => ({
      "Status":       STATUS_CONFIG[inv.status].label,
      "NFS-e":        inv.nfse_number ?? "",
      "Cliente":      inv.client_name,
      "CPF/CNPJ":     maskSensitiveCpfCnpj(inv.client_cpf_cnpj),
      "Serviço":      SERVICE_LABELS[inv.service_type],
      "Competência":  inv.reference_month
                        ? `${MONTH_NAMES[inv.reference_month - 1]}/${inv.reference_year}`
                        : inv.reference_year,
      "Vencimento":   inv.due_date   ? formatDate(inv.due_date)  : "",
      "Valor (R$)":   Number(inv.amount).toFixed(2).replace(".", ","),
      "Código Imóvel": inv.property_code ?? "",
      "Endereço":     inv.property_address ?? "",
      "Emitida em":   inv.issued_at  ? formatDate(inv.issued_at) : "",
      "Paga em":      inv.paid_at    ? formatDate(inv.paid_at)   : "",
      "Título DW":    inv.title_number ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notas Fiscais");
    XLSX.writeFile(wb, `notas-fiscais-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Criar nota manual ──
  const handleManualCreate = async () => {
    if (!manualForm.client_name || !manualForm.client_cpf_cnpj || !manualForm.service_type || !manualForm.amount || !manualForm.reference_year) {
      setManualError("Preencha todos os campos obrigatórios (*).");
      return;
    }
    setManualLoading(true);
    setManualError(null);
    const yr = Number(manualForm.reference_year);
    const mo = manualForm.reference_month ? Number(manualForm.reference_month) : new Date().getMonth() + 1;
    const amt = parseFloat(manualForm.amount.replace(/\./g, "").replace(",", ".")) || 0;
    const { title, body } = buildManualDescription(
      manualForm.service_type, manualForm.property_address, manualForm.property_code,
      mo, yr, manualForm.client_name, amt,
    );
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name:      manualForm.client_name,
          client_cpf_cnpj:  manualForm.client_cpf_cnpj.replace(/\D/g, ""),
          client_contact:   manualForm.client_contact  || null,
          property_code:    manualForm.property_code   || null,
          property_address: manualForm.property_address || null,
          service_type:     manualForm.service_type,
          amount:           amt,
          reference_year:   yr,
          reference_month:  mo,
          due_date:         manualForm.due_date || null,
          description_title: title,
          description_body:  body,
          notes:            manualForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setManualError(data.error ?? "Erro ao criar nota."); return; }
      setManualModal(false);
      setManualForm(EMPTY_MANUAL_FORM);
      await fetchInvoices();
    } catch {
      setManualError("Erro de conexão. Tente novamente.");
    } finally {
      setManualLoading(false);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep:      emitCep      || undefined,
          aliquota: emitAliquota ? Number(emitAliquota) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEmitError(data.details ?? data.error ?? "Falha ao emitir."); return; }
      setEmitModal(null);
      await fetchInvoices();
    } catch {
      setEmitError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setEmitting(false);
    }
  };

  // ── CEP lookup ──
  const lookupCep = async () => {
    if (!emitModal?.property_address) return;
    setCepLoading(true);
    setCepResults([]);
    try {
      const res = await fetch(`/api/cep-lookup?address=${encodeURIComponent(emitModal.property_address)}`);
      const data = await res.json();
      if (data.results?.length > 0) { setCepResults(data.results); setEmitCep(data.results[0].cep_formatted); }
    } catch { /* falha silenciosa */ } finally { setCepLoading(false); }
  };

  // ── Import DW: parse (preview) ──
  const handleFileSelect = async (file: File) => {
    setImportFile(file); setImportPreview(null); setImportErrors([]); setImportSuccess(null); setImporting(true);
    try {
      const formData = new FormData(); formData.append("file", file);
      const res  = await fetch("/api/invoices/import-dw", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setImportErrors(data.parseErrors ?? [{ rowIndex: 0, message: data.error }]); return; }
      setImportPreview(data.preview ?? []); setImportSummary(data.summary ?? null); setImportErrors(data.parseErrors ?? []);
    } catch {
      setImportErrors([{ rowIndex: 0, message: "Erro ao ler o arquivo. Tente novamente." }]);
    } finally { setImporting(false); }
  };

  // ── Import DW: confirmar ──
  const handleImportConfirm = async () => {
    if (!importFile) return;
    setImporting(true); setImportSuccess(null);
    try {
      const formData = new FormData(); formData.append("file", importFile);
      const res  = await fetch("/api/invoices/import-dw?confirm=true", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setImportErrors([{ rowIndex: 0, message: data.error ?? "Erro ao importar." }]); return; }
      setImportSuccess(data.message); setImportPreview(null); setImportFile(null);
      await fetchInvoices();
    } catch {
      setImportErrors([{ rowIndex: 0, message: "Erro de conexão ao importar." }]);
    } finally { setImporting(false); }
  };

  const handleClearPendingDw = async () => {
    setDwCleanupLoading(true);
    setDwCleanupMessage(null);
    try {
      const previewResponse = await fetch("/api/invoices/import-dw", { method: "DELETE" });
      const preview = await previewResponse.json().catch(() => ({}));
      if (!previewResponse.ok) throw new Error(preview.error ?? "Falha ao consultar importacoes DW pendentes.");

      const removable = Number(preview.removable ?? 0);
      if (removable === 0) {
        setDwCleanupMessage("Nao ha notas DW pendentes para remover.");
        return;
      }

      const confirmed = window.confirm(
        `Remover ${removable} nota(s) importada(s) do DW que ainda estao pendentes? Notas emitidas, enviadas, pagas ou canceladas nao serao apagadas.`
      );
      if (!confirmed) return;

      const cleanupResponse = await fetch("/api/invoices/import-dw?dryRun=false", { method: "DELETE" });
      const cleanup = await cleanupResponse.json().catch(() => ({}));
      if (!cleanupResponse.ok) throw new Error(cleanup.error ?? "Falha ao limpar importacoes DW pendentes.");

      setDwCleanupMessage(cleanup.message ?? `${cleanup.deleted ?? 0} nota(s) removida(s).`);
      setSelectedIds(new Set());
      await fetchInvoices();
    } catch (err) {
      setDwCleanupMessage(err instanceof Error ? err.message : "Falha ao limpar importacoes DW pendentes.");
    } finally {
      setDwCleanupLoading(false);
    }
  };

  const resetImport = () => {
    setImportFile(null); setImportPreview(null); setImportSummary(null);
    setImportErrors([]); setImportSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Relatório mensal ──
  const handleGenerateReport = () => {
    const mo = Number(reportMonth);
    const yr = Number(reportYear);
    const monthName = MONTH_NAMES[mo - 1];
    const ISS_RATE = 0.09;

    const mi = invoices.filter(i => i.reference_month === mo && i.reference_year === yr);

    const totalValue   = mi.reduce((s, i) => s + Number(i.amount), 0);
    const paidValue    = mi.filter(i => i.status === "PAGA").reduce((s, i) => s + Number(i.amount), 0);
    const emittedValue = mi.filter(i => ["EMITIDA","ENVIADA"].includes(i.status)).reduce((s, i) => s + Number(i.amount), 0);
    const pendingValue = mi.filter(i => i.status === "PENDENTE").reduce((s, i) => s + Number(i.amount), 0);
    const issTotal     = totalValue * ISS_RATE;

    const byService = (["INTERMEDIACAO","AGENCIAMENTO","ADMINISTRACAO"] as const).map(key => {
      const items = mi.filter(i => i.service_type === key);
      const total = items.reduce((s, i) => s + Number(i.amount), 0);
      const paid  = items.filter(i => i.status === "PAGA").reduce((s, i) => s + Number(i.amount), 0);
      return { label: SERVICE_LABELS[key], count: items.length, total, paid, iss: total * ISS_RATE };
    }).filter(s => s.count > 0);

    const statusGroups = [
      { label: "Pagas",      color: "#16a34a", count: mi.filter(i => i.status === "PAGA").length },
      { label: "Emitidas",   color: "#4338ca", count: mi.filter(i => i.status === "EMITIDA").length },
      { label: "Enviadas",   color: "#7c3aed", count: mi.filter(i => i.status === "ENVIADA").length },
      { label: "Pendentes",  color: "#d97706", count: mi.filter(i => i.status === "PENDENTE").length },
      { label: "Canceladas", color: "#9ca3af", count: mi.filter(i => i.status === "CANCELADA").length },
      { label: "Erro",       color: "#dc2626", count: mi.filter(i => i.status === "ERRO").length },
    ].filter(s => s.count > 0);

    const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

    const rowColor = (status: string) => {
      const map: Record<string, string> = {
        PAGA: "#f0fdf4", EMITIDA: "#eef2ff", ENVIADA: "#f5f3ff",
        PENDENTE: "#fffbeb", CANCELADA: "#f9fafb", ERRO: "#fef2f2",
      };
      return map[status] ?? "#fff";
    };

    const detailRows = mi.map(inv => `
      <tr style="background:${rowColor(inv.status)}">
        <td>${inv.nfse_number ? `NFS-e ${inv.nfse_number}` : inv.title_number ?? "—"}</td>
        <td>${inv.client_name}<br/><span style="color:#6b7280;font-size:11px">${maskSensitiveCpfCnpj(inv.client_cpf_cnpj)}</span></td>
        <td>${SERVICE_LABELS[inv.service_type]}</td>
        <td style="text-align:right;font-weight:600">${fmt(Number(inv.amount))}</td>
        <td style="text-align:center">
          <span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:${rowColor(inv.status)};border:1px solid #e5e7eb">
            ${STATUS_CONFIG[inv.status as InvoiceStatus].label}
          </span>
        </td>
        <td style="text-align:center">${fmtDate(inv.issued_at)}</td>
        <td style="text-align:center">${fmtDate(inv.paid_at)}</td>
        <td>${inv.property_address ?? inv.property_code ?? "—"}</td>
      </tr>`).join("");

    const byServiceRows = byService.map(s => `
      <tr>
        <td><strong>${s.label}</strong></td>
        <td style="text-align:center">${s.count}</td>
        <td style="text-align:right">${fmt(s.total)}</td>
        <td style="text-align:right;color:#16a34a">${fmt(s.paid)}</td>
        <td style="text-align:right;color:#dc2626">${fmt(s.total - s.paid)}</td>
        <td style="text-align:right;color:#1d4ed8">${fmt(s.iss)}</td>
      </tr>`).join("");

    const statusBadges = statusGroups.map(s =>
      `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px;font-size:13px">
        <span style="width:10px;height:10px;border-radius:50%;background:${s.color};display:inline-block"></span>
        ${s.label}: <strong>${s.count}</strong>
      </span>`).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório NFS-e — ${monthName}/${yr}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#f5f5f5;color:#1a1a2e;font-size:13px}
  .page{max-width:920px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10)}
  .header{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:#fff;padding:40px 48px 32px}
  .tag{display:inline-block;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:3px 12px;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:14px;color:#93c5fd}
  .header h1{font-size:26px;font-weight:700;line-height:1.2;margin-bottom:6px}
  .header p{color:#94a3b8;font-size:13px}
  .header-meta{display:flex;gap:28px;margin-top:24px;padding-top:24px;border-top:1px solid rgba(255,255,255,.1);flex-wrap:wrap}
  .meta-item label{display:block;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin-bottom:3px}
  .meta-item span{font-size:13px;font-weight:500;color:#e2e8f0}
  .body{padding:40px 48px}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:36px}
  .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px}
  .card .cl{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#64748b;margin-bottom:4px}
  .card .cv{font-size:20px;font-weight:700;color:#0f172a}
  .card .cs{font-size:11px;color:#94a3b8;margin-top:2px}
  .card.green{border-left:3px solid #22c55e}.card.green .cv{color:#16a34a}
  .card.amber{border-left:3px solid #f59e0b}.card.amber .cv{color:#d97706}
  .card.blue{border-left:3px solid #3b82f6}.card.blue .cv{color:#1d4ed8}
  .card.red{border-left:3px solid #ef4444}.card.red .cv{color:#dc2626}
  .section{margin-bottom:36px}
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:8px;margin-bottom:18px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;padding:9px 12px;background:#f8fafc;border-bottom:2px solid #e2e8f0;color:#475569;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
  td{padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
  tr.total td{font-weight:700;border-top:2px solid #e2e8f0;background:#f8fafc}
  .iss-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px 24px;margin-bottom:36px}
  .iss-box h3{font-size:13px;font-weight:700;color:#1e40af;margin-bottom:12px}
  .iss-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .iss-item{background:#fff;border-radius:8px;padding:14px;border:1px solid #dbeafe}
  .iss-item .il{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#60a5fa;margin-bottom:4px}
  .iss-item .iv{font-size:17px;font-weight:700;color:#1e40af}
  .iss-item .is{font-size:11px;color:#93c5fd}
  .status-bar{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:36px}
  .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 48px;display:flex;justify-content:space-between;align-items:center}
  .footer p{font-size:11px;color:#94a3b8}
  .btn-print{background:#1e3a5f;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  .btn-print:hover{background:#1e40af}
  @media print{body{background:#fff}.page{margin:0;border-radius:0;box-shadow:none}.btn-print{display:none}@page{margin:0}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="tag">Relatório Fiscal</div>
    <h1>Notas Fiscais de Serviço<br>${monthName} / ${yr}</h1>
    <p>Imobiliária Moinhos de Vento — Auxiliadora Predial</p>
    <div class="header-meta">
      <div class="meta-item"><label>Competência</label><span>${monthName}/${yr}</span></div>
      <div class="meta-item"><label>Total de notas</label><span>${mi.length}</span></div>
      <div class="meta-item"><label>Gerado em</label><span>${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span></div>
      <div class="meta-item"><label>Alíquota ISS</label><span>9% (Simples Nacional)</span></div>
    </div>
  </div>

  <div class="body">

    <div class="cards">
      <div class="card"><div class="cl">Total emitido</div><div class="cv">${fmt(totalValue)}</div><div class="cs">${mi.length} nota(s)</div></div>
      <div class="card green"><div class="cl">Recebido (Pago)</div><div class="cv">${fmt(paidValue)}</div><div class="cs">${mi.filter(i=>i.status==="PAGA").length} nota(s)</div></div>
      <div class="card amber"><div class="cl">Em aberto</div><div class="cv">${fmt(emittedValue)}</div><div class="cs">emitidas/enviadas</div></div>
      <div class="card red"><div class="cl">Pendente emissão</div><div class="cv">${fmt(pendingValue)}</div><div class="cs">${mi.filter(i=>i.status==="PENDENTE").length} nota(s)</div></div>
    </div>

    <div class="iss-box">
      <h3>ISS — Imposto Sobre Serviços (9% Simples Nacional)</h3>
      <div class="iss-grid">
        <div class="iss-item"><div class="il">ISS Total (base: ${fmt(totalValue)})</div><div class="iv">${fmt(issTotal)}</div><div class="is">sobre todas as notas do mês</div></div>
        <div class="iss-item"><div class="il">ISS Recolhido (base: ${fmt(paidValue)})</div><div class="iv">${fmt(paidValue * ISS_RATE)}</div><div class="is">notas já pagas</div></div>
        <div class="iss-item"><div class="il">ISS a Recolher (base: ${fmt(emittedValue)})</div><div class="iv">${fmt(emittedValue * ISS_RATE)}</div><div class="is">notas emitidas em aberto</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Por Tipo de Serviço</div>
      <table>
        <thead>
          <tr>
            <th>Tipo de Serviço</th>
            <th style="text-align:center">Qtd</th>
            <th style="text-align:right">Valor Total</th>
            <th style="text-align:right">Recebido</th>
            <th style="text-align:right">Em Aberto</th>
            <th style="text-align:right">ISS (9%)</th>
          </tr>
        </thead>
        <tbody>
          ${byServiceRows}
          <tr class="total">
            <td>Total Geral</td>
            <td style="text-align:center">${mi.length}</td>
            <td style="text-align:right">${fmt(totalValue)}</td>
            <td style="text-align:right;color:#16a34a">${fmt(paidValue)}</td>
            <td style="text-align:right;color:#d97706">${fmt(emittedValue)}</td>
            <td style="text-align:right;color:#1d4ed8">${fmt(issTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="status-bar">
      <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#64748b;margin-right:20px">Distribuição por Status</span>
      ${statusBadges}
    </div>

    <div class="section">
      <div class="section-title">Detalhamento das Notas (${mi.length})</div>
      ${mi.length === 0 ? '<p style="color:#94a3b8;text-align:center;padding:24px">Nenhuma nota para este período.</p>' : `
      <table>
        <thead>
          <tr>
            <th>Número</th>
            <th>Tomador</th>
            <th>Serviço</th>
            <th style="text-align:right">Valor</th>
            <th style="text-align:center">Status</th>
            <th style="text-align:center">Emitida</th>
            <th style="text-align:center">Paga</th>
            <th>Imóvel</th>
          </tr>
        </thead>
        <tbody>${detailRows}</tbody>
      </table>`}
    </div>

  </div>

  <div class="footer">
    <p><strong>Imobiliária Moinhos de Vento</strong> — Relatório gerado automaticamente pelo sistema de gestão</p>
    <button class="btn-print" onclick="window.print()">Imprimir / Salvar PDF</button>
  </div>
</div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
    setReportModal(false);
  };

  // ── Seleção ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendentesInView.map(i => i.id)));
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notas Fiscais</h1>
          <p className="text-sm text-gray-500 mt-0.5">Importação do DW, emissão de NFS-e e controle de ciclo de vida.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchInvoices}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setReportModal(true)}
            className="flex items-center gap-2 px-3 py-2 border border-indigo-300 text-indigo-700 bg-indigo-50 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Relatório Mensal
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            title="Exportar lista atual para Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar
          </button>
          <button
            onClick={handleClearPendingDw}
            disabled={dwCleanupLoading}
            className="flex items-center gap-2 px-3 py-2 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg text-sm font-medium hover:bg-amber-100 disabled:opacity-50 transition-colors"
            title="Remove somente notas importadas do DW que ainda estao pendentes"
          >
            {dwCleanupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Limpar DW pendente
          </button>
          <button
            onClick={() => { setManualModal(true); setManualForm(EMPTY_MANUAL_FORM); setManualError(null); }}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova Nota
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
      {dwCleanupMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {dwCleanupMessage}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          overdueCount > 0 ? "border-orange-200 bg-orange-50" : "border-gray-200"
        )}>
          <p className={cn("text-xs mb-1", overdueCount > 0 ? "text-orange-500" : "text-gray-500")}>Vencidas</p>
          <p className={cn("text-xl font-bold", overdueCount > 0 ? "text-orange-700" : "text-gray-400")}>{overdueCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">pendentes vencidas</p>
        </div>
        <div className={cn(
          "bg-white p-4 rounded-xl border transition-colors",
          totalErro > 0 ? "border-red-200 bg-red-50" : "border-gray-200"
        )}>
          <p className={cn("text-xs mb-1", totalErro > 0 ? "text-red-500" : "text-gray-500")}>Com Erro</p>
          <p className={cn("text-xl font-bold", totalErro > 0 ? "text-red-700" : "text-gray-400")}>{totalErro}</p>
          <p className="text-xs text-gray-400 mt-0.5">requer atenção</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        {[
          { id: "todas",     label: `Todas (${invoices.length})` },
          { id: "pendentes", label: `Pendentes (${summary?.pendentes ?? 0})` },
          { id: "vencidas",  label: `Vencidas (${overdueCount})`, alert: overdueCount > 0 },
          { id: "erro",      label: `Erros (${totalErro})`, alert: totalErro > 0 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
              activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
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
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Todos os meses</option>
          {MONTH_NAMES.map((m, i) => (
            <option key={i + 1} value={String(i + 1)}>{m}</option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Todos os anos</option>
          {[2024, 2025, 2026, 2027].map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        {(filterMonth || filterYear || filterStatus || filterService) && (
          <button
            onClick={() => { setFilterMonth(""); setFilterYear(""); setFilterStatus(""); setFilterService(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── Barra de ação em lote ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          {batchEmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-blue-700 font-medium">
                Emitindo... {batchProgress.done}/{batchProgress.total}
              </span>
              <div className="flex-1 bg-blue-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700 font-medium">
                {selectedIds.size} nota(s) selecionada(s)
              </span>
              <button
                onClick={handleBatchEmit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                <Zap className="h-3 w-3" />
                Emitir todas ({selectedIds.size})
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                Cancelar seleção
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Tabela ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando notas fiscais...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-red-500 gap-2">
            <AlertCircle className="h-5 w-5" />{error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600">
                      {allSelected
                        ? <CheckSquare className="h-4 w-4 text-blue-600" />
                        : <Square className="h-4 w-4" />}
                    </button>
                  </th>
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
                    <td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                      <FileText className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                      Nenhuma nota fiscal encontrada.
                    </td>
                  </tr>
                ) : filtered.map((inv) => {
                  const st        = STATUS_CONFIG[inv.status];
                  const StatusIcon = st.icon;
                  const isExpanded = expandedId === inv.id;
                  const overdue   = isOverdue(inv);
                  const isSelected = selectedIds.has(inv.id);

                  return (
                    <>
                      <tr key={inv.id} className={cn(
                        "group hover:bg-gray-50 transition-colors",
                        overdue    && "bg-orange-50/40",
                        inv.status === "ERRO"  && "bg-red-50/30",
                        isSelected && "bg-blue-50/40",
                      )}>
                        {/* Checkbox */}
                        <td className="px-4 py-3">
                          {["PENDENTE","ERRO"].includes(inv.status) ? (
                            <button onClick={() => toggleSelect(inv.id)} className="text-gray-400 hover:text-blue-600">
                              {isSelected
                                ? <CheckSquare className="h-4 w-4 text-blue-600" />
                                : <Square className="h-4 w-4" />}
                            </button>
                          ) : (
                            <span className="block w-4" />
                          )}
                        </td>

                        {/* # */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            {inv.nfse_number ? (
                              <span className="text-xs font-mono text-green-700 bg-green-50 px-1.5 py-0.5 rounded">NFS-e {inv.nfse_number}</span>
                            ) : inv.year_sequence ? (
                              <span className="text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                NF-{inv.reference_year}-{String(inv.year_sequence).padStart(3, "0")}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                            {inv.imported_from_dw
                              ? <span className="text-[10px] text-gray-400">DW</span>
                              : <span className="text-[10px] text-purple-400">Manual</span>}
                          </div>
                        </td>

                        {/* Cliente */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {overdue && (
                              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" aria-label="Vencida" />
                            )}
                            <div>
                              <p className="font-medium text-gray-900 truncate max-w-[180px]">{inv.client_name}</p>
                              <p className="text-xs text-gray-400">{maskSensitiveCpfCnpj(inv.client_cpf_cnpj)}</p>
                            </div>
                          </div>
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
                            <StatusIcon className={cn("h-3 w-3", inv.status === "PROCESSANDO" && "animate-spin")} />
                            {st.label}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {/* Emitir */}
                            {(inv.status === "PENDENTE" || inv.status === "ERRO") && (
                              <button
                                onClick={() => { setEmitModal(inv); setEmitError(null); setEmitCep(""); setEmitAliquota("9"); setCepResults([]); }}
                                className="p-1.5 border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Emitir NFS-e"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {/* Marcar enviada */}
                            {inv.status === "EMITIDA" && (
                              <button
                                onClick={() => updateStatus(inv.id, "ENVIADA")}
                                className="p-1.5 border border-purple-200 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors"
                                title="Marcar como enviada ao cliente"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {/* Marcar paga */}
                            {(inv.status === "EMITIDA" || inv.status === "ENVIADA") && (
                              <button
                                onClick={() => updateStatus(inv.id, "PAGA")}
                                className="p-1.5 border border-green-200 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                                title="Marcar como paga"
                              >
                                <DollarSign className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {/* Download PDF */}
                            {inv.gateway_pdf_url && (
                              <a
                                href={inv.gateway_pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                                title="Baixar DANFE (PDF)"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {/* Cancelar — abre modal */}
                            {!["CANCELADA", "PAGA", "PROCESSANDO"].includes(inv.status) && (
                              <button
                                onClick={() => { setCancelModal(inv); setCancelReason(""); }}
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
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Linha expandida */}
                      {isExpanded && (
                        <tr key={`${inv.id}-detail`} className="bg-gray-50/80">
                          <td colSpan={9} className="px-6 py-4 border-t border-gray-100">
                            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4 mb-4">
                              <div className="space-y-3">
                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Situacao da nota</p>
                                      <h3 className="text-sm font-semibold text-gray-900 mt-1">{invoiceCode(inv)}</h3>
                                      <p className="text-xs text-gray-500 mt-1">{operationMessage(inv)}</p>
                                    </div>
                                    <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border", st.color)}>
                                      <StatusIcon className={cn("h-3 w-3", inv.status === "PROCESSANDO" && "animate-spin")} />
                                      {st.label}
                                    </span>
                                  </div>

                                  {inv.status === "ERRO" && (
                                    <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                                      {(() => {
                                        const explained = explainEmitError(inv.last_emit_error);
                                        return (
                                          <>
                                            <p className="text-sm font-semibold text-red-800">{explained.title}</p>
                                            <p className="text-xs text-red-700 mt-1">{explained.action}</p>
                                            {inv.last_emit_error && (
                                              <details className="mt-2">
                                                <summary className="text-[11px] text-red-600 cursor-pointer">Ver detalhe tecnico</summary>
                                                <p className="mt-1 text-[11px] text-red-700 font-mono break-words">{inv.last_emit_error}</p>
                                              </details>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>

                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Gateway e emissao</p>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    <div>
                                      <p className="text-gray-400 mb-0.5">Provider</p>
                                      <p className="font-mono text-gray-700">{inv.gateway_provider || "aguardando"}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-400 mb-0.5">Status gateway</p>
                                      <p className="font-mono text-gray-700">{inv.gateway_status || "-"}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-400 mb-0.5">Tentativas</p>
                                      <p className="font-medium text-gray-700">{inv.emit_attempts}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-400 mb-0.5">Ultima tentativa</p>
                                      <p className="font-medium text-gray-700">{inv.last_emit_at ? formatDate(inv.last_emit_at) : "-"}</p>
                                    </div>
                                  </div>
                                  {inv.gateway_id && (
                                    <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 p-2 text-xs">
                                      <p className="text-gray-400 mb-1">ID no gateway</p>
                                      <p className="font-mono text-gray-700 break-all">{inv.gateway_id}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-4">Historico visual</p>
                                <div className="space-y-4">
                                  {buildInvoiceTimeline(inv).map((event, index) => (
                                    <div key={`${event.label}-${index}`} className="relative flex gap-3">
                                      {index < buildInvoiceTimeline(inv).length - 1 && (
                                        <div className="absolute left-[7px] top-4 h-full w-px bg-gray-200" />
                                      )}
                                      <div className={cn(
                                        "relative z-10 mt-1 h-3.5 w-3.5 rounded-full border-2 bg-white",
                                        event.tone === "green" && "border-green-500",
                                        event.tone === "red" && "border-red-500",
                                        event.tone === "amber" && "border-amber-500",
                                        event.tone === "purple" && "border-purple-500",
                                        event.tone === "blue" && "border-blue-500",
                                        event.tone === "gray" && "border-gray-400",
                                      )} />
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-gray-900">{event.label}</p>
                                        <p className="text-[11px] text-gray-400">{event.date ? formatDate(event.date) : "Data nao registrada"}</p>
                                        <p className="text-xs text-gray-600 mt-0.5">{event.detail}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs mb-3">
                              <div>
                                <p className="text-gray-400 mb-0.5">Código do Imóvel</p>
                                <p className="font-mono text-gray-700">{inv.property_code || "—"}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-0.5">Endereço do Imóvel</p>
                                <p className="font-medium text-gray-700">{inv.property_address || "—"}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-0.5">Título DW</p>
                                <p className="font-mono text-gray-700">{inv.title_number || "—"}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-0.5">Vencimento DW</p>
                                <p className={cn("font-medium", overdue ? "text-orange-600" : "text-gray-700")}>
                                  {inv.due_date ? formatDate(inv.due_date) : "—"}
                                  {overdue && " ⚠ Vencida"}
                                </p>
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

                            {inv.notes && (
                              <div className="text-xs bg-gray-100 rounded-lg p-2 mb-2">
                                <p className="text-gray-500 font-medium mb-0.5">Observações:</p>
                                <p className="text-gray-700">{inv.notes}</p>
                              </div>
                            )}

                            {inv.last_emit_error && (
                              <div className="text-xs bg-red-50 border border-red-100 rounded-lg p-2 mb-2">
                                <p className="text-red-500 font-medium mb-0.5">Erro na última emissão:</p>
                                <p className="text-red-600 font-mono">{inv.last_emit_error}</p>
                              </div>
                            )}

                            {inv.gateway_id && (
                              <div className="text-xs text-gray-400 mb-1">
                                Gateway ID: <span className="font-mono text-gray-600">{inv.gateway_id}</span>
                                {inv.emit_attempts > 0 && ` · ${inv.emit_attempts} tentativa(s)`}
                              </div>
                            )}

                            {(inv.gateway_pdf_url || inv.gateway_xml_url) && (
                              <div className="flex gap-2 mt-1">
                                {inv.gateway_pdf_url && (
                                  <a href={inv.gateway_pdf_url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                                    <Download className="h-3 w-3" />DANFE (PDF)
                                  </a>
                                )}
                                {inv.gateway_xml_url && (
                                  <a href={inv.gateway_xml_url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                                    <Download className="h-3 w-3" />XML
                                  </a>
                                )}
                              </div>
                            )}

                            <div className="mt-2 flex gap-4 text-xs">
                              {inv.issued_at    && <p className="text-gray-400">Emitida: <span className="text-gray-700">{formatDate(inv.issued_at)}</span></p>}
                              {inv.sent_at      && <p className="text-gray-400">Enviada: <span className="text-gray-700">{formatDate(inv.sent_at)}</span></p>}
                              {inv.paid_at      && <p className="text-gray-400">Paga: <span className="text-green-700 font-medium">{formatDate(inv.paid_at)}</span></p>}
                              {inv.cancelled_at && <p className="text-gray-400">Cancelada: <span className="text-gray-700">{formatDate(inv.cancelled_at)}</span></p>}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Emitir NFS-e</h2>
                <p className="text-xs text-gray-500 mt-0.5">Revise os dados antes de emitir. Esta ação é irreversível.</p>
              </div>
              <button onClick={() => setEmitModal(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-400 mb-0.5">Tomador</p>
                  <p className="font-medium text-gray-900 bg-gray-50 rounded px-2 py-1.5 truncate">{emitModal.client_name}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">CPF / CNPJ</p>
                  <p className="font-mono text-gray-900 bg-gray-50 rounded px-2 py-1.5">{emitModal.client_cpf_cnpj}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Endereço do imóvel</p>
                {emitModal.property_address && (
                  <p className="text-xs text-gray-600 mb-2 bg-gray-50 rounded px-2 py-1.5">{emitModal.property_address}</p>
                )}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-0.5 block">CEP</label>
                    <input
                      type="text" value={emitCep} onChange={(e) => setEmitCep(e.target.value)}
                      placeholder="00000-000" maxLength={9}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  {emitModal.property_address && (
                    <button
                      onClick={lookupCep} disabled={cepLoading}
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
                    >
                      {cepLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                      Buscar CEP
                    </button>
                  )}
                </div>
                {cepResults.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {cepResults.length > 1 && <p className="text-[10px] text-gray-400">Selecione o CEP correto:</p>}
                    {cepResults.map((r) => (
                      <button
                        key={r.cep_formatted} onClick={() => setEmitCep(r.cep_formatted)}
                        className={cn(
                          "w-full text-left text-xs px-2 py-1.5 rounded border transition-colors",
                          emitCep === r.cep_formatted ? "border-blue-400 bg-blue-50 text-blue-800" : "border-gray-200 hover:bg-gray-50 text-gray-700"
                        )}
                      >
                        <span className="font-mono font-medium">{r.cep_formatted}</span>{" — "}{r.logradouro}, {r.bairro}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-400 mb-0.5">Valor do serviço</p>
                  <p className="text-xl font-bold text-gray-900 bg-gray-50 rounded px-2 py-1.5">{formatCurrency(Number(emitModal.amount))}</p>
                </div>
                <div>
                  <label className="text-gray-400 mb-0.5 block">Alíquota Simples Nacional (%)</label>
                  <input
                    type="number" min="0" max="100" step="0.5" value={emitAliquota}
                    onChange={(e) => setEmitAliquota(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="text-xs">
                <p className="text-gray-400 mb-0.5">Descrição da NFS-e</p>
                <p className="text-gray-700 bg-gray-50 rounded px-2 py-2 leading-relaxed">{emitModal.description_body}</p>
              </div>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowFixedFields(!showFixedFields)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-gray-400" />
                    Campos preenchidos automaticamente pelo sistema
                  </span>
                  {showFixedFields ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showFixedFields && (
                  <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-2 text-xs border-t border-gray-100">
                    {[
                      ["Data de emissão", new Date().toLocaleDateString("pt-BR")],
                      ["Regime de apuração", "Simples Nacional"],
                      ["País do tomador", "Brasil"],
                      ["Município de incidência", "Porto Alegre – RS"],
                      ["Cód. tributação nacional", "10.05.01"],
                      ["Cód. complementar municipal", "10.05.01.002"],
                      ["Imunidade", "Não"],
                      ["Retenção ISSQN", "Não"],
                      ["Dedução / Redução", "Não"],
                      ["Tributação federal", "00 – Nenhum"],
                      ["Tipo PIS/COFINS", "Não retido"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-gray-400 mb-0.5">{label}</p>
                        <p className="font-medium text-gray-700 bg-gray-50 rounded px-2 py-1">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <p>Modo de desenvolvimento — a nota será registrada no sistema, mas <strong>não enviada à prefeitura</strong> até o certificado digital ser configurado.</p>
              </div>
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                <Zap className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Preparado para NFS.io</p>
                  <p className="mt-0.5">Quando HML/PRD estiverem prontos, este mesmo fluxo usara as variaveis NFSE_* e o certificado A1 configurados no ambiente.</p>
                </div>
              </div>
              {emitModal.emit_attempts > 0 && (
                <p className="text-xs text-gray-400">Tentativas anteriores: {emitModal.emit_attempts}</p>
              )}
              {emitError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    {(() => {
                      const explained = explainEmitError(emitError);
                      return (
                        <>
                          <p className="font-semibold">{explained.title}</p>
                          <p className="mt-0.5">{explained.action}</p>
                          <details className="mt-2">
                            <summary className="text-red-600 cursor-pointer">Ver detalhe tecnico</summary>
                            <p className="mt-1 font-mono break-words">{emitError}</p>
                          </details>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setEmitModal(null)} disabled={emitting} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50">Cancelar</button>
              <button
                onClick={handleEmit} disabled={emitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {emitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Emitindo...</> : <><FileText className="h-4 w-4" /> Confirmar Emissão</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL DE CANCELAMENTO
      ═══════════════════════════════════════════════════════════════════ */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Cancelar Nota Fiscal</h2>
                <p className="text-xs text-gray-500 mt-0.5">{cancelModal.client_name} · {formatCurrency(Number(cancelModal.amount))}</p>
              </div>
              <button onClick={() => setCancelModal(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  {["EMITIDA","ENVIADA"].includes(cancelModal.status)
                    ? "Esta nota já foi emitida. O cancelamento no sistema não cancela automaticamente na prefeitura — faça o cancelamento também no portal do nfse.io após confirmar aqui."
                    : "Esta ação marcará a nota como cancelada e não poderá ser desfeita."}
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Motivo do cancelamento (opcional)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex: emitida em duplicata, dados incorretos do tomador..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setCancelModal(null)} disabled={cancelLoading} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50">Voltar</button>
              <button
                onClick={handleCancelConfirm} disabled={cancelLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {cancelLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Cancelando...</> : <><Ban className="h-4 w-4" /> Confirmar Cancelamento</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL NOTA MANUAL
      ═══════════════════════════════════════════════════════════════════ */}
      {manualModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Nova Nota Fiscal Manual</h2>
                <p className="text-xs text-gray-500 mt-0.5">Para notas que não vieram do DW — serviços avulsos ou correções.</p>
              </div>
              <button onClick={() => setManualModal(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Tomador */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Tomador do serviço</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Nome *</label>
                    <input
                      type="text" value={manualForm.client_name}
                      onChange={e => setManualForm(f => ({ ...f, client_name: e.target.value }))}
                      placeholder="Nome completo ou razão social"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">CPF / CNPJ *</label>
                    <input
                      type="text" value={manualForm.client_cpf_cnpj}
                      onChange={e => setManualForm(f => ({ ...f, client_cpf_cnpj: e.target.value }))}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">E-mail / Contato</label>
                    <input
                      type="text" value={manualForm.client_contact}
                      onChange={e => setManualForm(f => ({ ...f, client_contact: e.target.value }))}
                      placeholder="email@exemplo.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Imóvel */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Imóvel</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Código do imóvel</label>
                    <input
                      type="text" value={manualForm.property_code}
                      onChange={e => setManualForm(f => ({ ...f, property_code: e.target.value }))}
                      placeholder="Ex: 12345"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Endereço</label>
                    <input
                      type="text" value={manualForm.property_address}
                      onChange={e => setManualForm(f => ({ ...f, property_address: e.target.value }))}
                      placeholder="Rua, número, bairro"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Serviço e valores */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Serviço e competência</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Tipo de serviço *</label>
                    <select
                      value={manualForm.service_type}
                      onChange={e => setManualForm(f => ({ ...f, service_type: e.target.value as ServiceType }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione...</option>
                      {Object.entries(SERVICE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Valor (R$) *</label>
                    <input
                      type="text" value={manualForm.amount}
                      onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0,00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Mês de competência</label>
                    <select
                      value={manualForm.reference_month}
                      onChange={e => setManualForm(f => ({ ...f, reference_month: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {MONTH_NAMES.map((m, i) => (
                        <option key={i + 1} value={String(i + 1)}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Ano de competência *</label>
                    <input
                      type="number" value={manualForm.reference_year}
                      onChange={e => setManualForm(f => ({ ...f, reference_year: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Data de vencimento</label>
                    <input
                      type="date" value={manualForm.due_date}
                      onChange={e => setManualForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Observações internas</label>
                <textarea
                  value={manualForm.notes}
                  onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notas internas — não aparecem na NFS-e"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {manualError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><p>{manualError}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setManualModal(false)} disabled={manualLoading} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50">Cancelar</button>
              <button
                onClick={handleManualCreate} disabled={manualLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {manualLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</> : <><Plus className="h-4 w-4" /> Criar Nota</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL RELATÓRIO MENSAL
      ═══════════════════════════════════════════════════════════════════ */}
      {reportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Relatório Mensal para Contador</h2>
                <p className="text-xs text-gray-500 mt-0.5">Selecione o período — abre em nova aba, pronto para impressão.</p>
              </div>
              <button onClick={() => setReportModal(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Mês</label>
                  <select
                    value={reportMonth}
                    onChange={e => setReportMonth(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {MONTH_NAMES.map((m, i) => (
                      <option key={i + 1} value={String(i + 1)}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Ano</label>
                  <select
                    value={reportYear}
                    onChange={e => setReportYear(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-700">
                O relatório incluirá: resumo financeiro, ISS a recolher, breakdown por tipo de serviço e listagem completa das notas.
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setReportModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button
                onClick={handleGenerateReport}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Gerar Relatório
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
            <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Importar Notas do DW</h2>
                <p className="text-xs text-gray-500 mt-0.5">Selecione o arquivo Excel (.xlsx) ou CSV exportado do DW da Auxiliadora Predial.</p>
              </div>
              <button onClick={() => setImportModal(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {importSuccess && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{importSuccess}</p>
                </div>
              )}
              {!importPreview && !importSuccess && (
                <label className={cn(
                  "flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors",
                  importing ? "border-blue-300 bg-blue-50 cursor-not-allowed" : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                )}>
                  <input
                    ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={importing}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                  />
                  {importing ? <Loader2 className="h-8 w-8 text-blue-400 animate-spin mb-2" /> : <Upload className="h-8 w-8 text-gray-300 mb-2" />}
                  <p className="text-sm font-medium text-gray-700">{importing ? "Lendo arquivo..." : "Clique ou arraste o arquivo Excel do DW"}</p>
                  <p className="text-xs text-gray-400 mt-1">Aceita .xlsx, .xls ou .csv (exportação DW) · Máximo 10MB</p>
                </label>
              )}
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm font-medium text-red-700">{importErrors.length} linha(s) com problema</p>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {importErrors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600">{e.rowIndex > 0 ? `Linha ${e.rowIndex}: ` : ""}{e.message}</p>
                    ))}
                  </div>
                </div>
              )}
              {importPreview && importSummary && (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Total lido",  value: importSummary.totalRows,     color: "text-gray-900" },
                      { label: "Novas",       value: importSummary.newRows,       color: "text-green-700" },
                      { label: "Duplicatas",  value: importSummary.duplicateRows, color: "text-amber-700" },
                      { label: "Erros",       value: importSummary.errorRows,     color: "text-red-700" },
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
                      {importSummary.newRows} nota(s) nova(s) serão importadas. Duplicatas (título já existente) serão ignoradas.
                    </p>
                  )}
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
                          <tr key={row.rowIndex} className={cn(row.import_status === "duplicata" && "opacity-50 bg-gray-50")}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-800 truncate max-w-[160px]">{row.client_name}</p>
                              <p className="text-gray-400">{maskSensitiveCpfCnpj(row.client_cpf_cnpj)}</p>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{SERVICE_LABELS[row.service_type as ServiceType] ?? row.service_type}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.due_date}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800 whitespace-nowrap">{formatCurrency(row.amount)}</td>
                            <td className="px-3 py-2 text-center">
                              {row.import_status === "nova"
                                ? <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-medium">Nova</span>
                                : <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">Duplicata</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-6 border-t border-gray-100 flex-shrink-0">
              <button onClick={resetImport} disabled={importing} className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50">
                {importPreview ? "Escolher outro arquivo" : "Limpar"}
              </button>
              <div className="flex gap-3">
                <button onClick={() => setImportModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Fechar</button>
                {importPreview && (importSummary?.newRows ?? 0) > 0 && (
                  <button
                    onClick={handleImportConfirm} disabled={importing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {importing
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
                      : <><Upload className="h-4 w-4" /> Importar {importSummary?.newRows} nota(s)</>}
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
