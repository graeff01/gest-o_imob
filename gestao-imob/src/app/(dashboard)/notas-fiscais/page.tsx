"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, Search, Send, CheckCircle2, Clock, Ban,
  DollarSign, Upload, AlertCircle, X, RefreshCw,
  Download, ChevronDown, ChevronUp, Loader2, AlertTriangle, Info,
  Plus, Square, CheckSquare, FileSpreadsheet, Zap,
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn, formatCurrency, formatDate, maskSensitiveCpfCnpj, validateCNPJ, validateCPF } from "@/lib/utils";

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

interface NfseCompanyConfig {
  appEnv: "local" | "homolog" | "production";
  gatewayMode: "stub" | "real";
  apiKeyConfigured: boolean;
  companyIdConfigured: boolean;
  companyCnpjConfigured: boolean;
  municipalRegistrationConfigured: boolean;
  cityCode: string;
  serviceCode: string;
  serviceCodeComplement: string;
  defaultAliquota: string;
  homologacao: boolean;
  prdReady: boolean;
  emissionEnabled: boolean;
  emissionBlockedReason: string | null;
  pendingProductionFields: string[];
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

interface ReadinessCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
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

function InvoiceVisualPreview({ invoice, cep, aliquota }: { invoice: Invoice; cep: string; aliquota: string }) {
  const amount = Number(invoice.amount) || 0;
  const rate = Number(aliquota) || 0;
  const issValue = amount * (rate / 100);
  const competence = invoice.reference_month
    ? `${MONTH_NAMES[invoice.reference_month - 1]}/${invoice.reference_year}`
    : String(invoice.reference_year);
  const serviceLabel = SERVICE_LABELS[invoice.service_type];
  const verificationCode = invoice.gateway_id ?? "Gerado apos emissao";

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3">
      <div className="mx-auto overflow-hidden rounded-sm border border-slate-300 bg-white text-slate-900 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b-4 border-blue-700 px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">Prefeitura Municipal de Canoas</p>
            <h3 className="mt-1 text-lg font-bold uppercase">Nota Fiscal de Servicos Eletronica</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">Espelho de conferencia com os dados que serao enviados</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase text-slate-500">Numero</p>
            <p className="font-mono text-base font-bold">{invoice.nfse_number ?? "PREVIA"}</p>
            <p className="mt-1 text-[10px] uppercase text-slate-500">Emissao</p>
            <p className="text-xs font-semibold">{new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 border-b border-slate-200 md:grid-cols-3">
          <div className="border-b border-slate-200 p-4 md:col-span-2 md:border-b-0 md:border-r">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Prestador do servico</p>
            <p className="mt-1 text-sm font-bold text-slate-900">Jardim do Lago</p>
            <p className="mt-1 text-xs text-slate-600">Municipio de incidencia: Canoas - RS</p>
            <p className="text-xs text-slate-600">Regime: Simples Nacional</p>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Competencia</p>
            <p className="mt-1 text-sm font-bold">{competence}</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Titulo DW</p>
            <p className="font-mono text-xs font-semibold">{invoice.title_number || "-"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 border-b border-slate-200 md:grid-cols-2">
          <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tomador do servico</p>
            <p className="mt-1 text-sm font-bold">{invoice.client_name}</p>
            <p className="mt-1 font-mono text-xs text-slate-700">{invoice.client_cpf_cnpj}</p>
            <p className="mt-1 text-xs text-slate-600">{invoice.client_contact || "Contato nao informado"}</p>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Endereco vinculado</p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-700">{invoice.property_address || "Endereco nao informado"}</p>
            <p className="mt-2 font-mono text-xs text-slate-600">CEP: {cep.trim() || "pendente"}</p>
          </div>
        </div>

        <div className="border-b border-slate-200 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Discriminacao dos servicos</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{invoice.description_title || serviceLabel}</p>
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-700">{invoice.description_body}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            <div>
              <p className="text-slate-500">Servico</p>
              <p className="font-semibold">{serviceLabel}</p>
            </div>
            <div>
              <p className="text-slate-500">Cod. tributacao</p>
              <p className="font-mono font-semibold">10.05.01</p>
            </div>
            <div>
              <p className="text-slate-500">ISS retido</p>
              <p className="font-semibold">Nao</p>
            </div>
            <div>
              <p className="text-slate-500">Verificacao</p>
              <p className="font-mono font-semibold">{verificationCode}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-xs md:grid-cols-4">
          <div className="p-4">
            <p className="text-slate-500">Valor do servico</p>
            <p className="mt-1 text-base font-bold">{formatCurrency(amount)}</p>
          </div>
          <div className="p-4">
            <p className="text-slate-500">Aliquota ISS</p>
            <p className="mt-1 text-base font-bold">{rate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</p>
          </div>
          <div className="p-4">
            <p className="text-slate-500">ISS estimado</p>
            <p className="mt-1 text-base font-bold">{formatCurrency(issValue)}</p>
          </div>
          <div className="p-4">
            <p className="text-slate-500">Valor liquido</p>
            <p className="mt-1 text-base font-bold">{formatCurrency(amount)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status da previa</p>
            <p className="text-xs text-slate-700">Documento de conferencia. O numero oficial, PDF e XML sao gerados somente apos a emissao.</p>
          </div>
          <div className="h-8 w-32 rounded bg-[repeating-linear-gradient(90deg,#0f172a_0,#0f172a_2px,transparent_2px,transparent_5px)] opacity-70" />
        </div>
      </div>
    </div>
  );
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

function isValidCpfCnpj(value: string) {
  const clean = value.replace(/\D/g, "");
  if (clean.length === 11) return validateCPF(clean);
  if (clean.length === 14) return validateCNPJ(clean);
  return false;
}

function validateInvoiceForEmission(inv: Invoice, cep: string, aliquota: string): ReadinessCheck[] {
  const cleanCep = cep.replace(/\D/g, "");
  const amount = Number(inv.amount);
  const aliquotaNumber = Number(aliquota);

  return [
    {
      id: "client",
      label: "Tomador",
      ok: inv.client_name.trim().length >= 2,
      detail: inv.client_name.trim().length >= 2 ? "Nome preenchido." : "Informe o nome do tomador.",
    },
    {
      id: "document",
      label: "CPF/CNPJ",
      ok: isValidCpfCnpj(inv.client_cpf_cnpj),
      detail: isValidCpfCnpj(inv.client_cpf_cnpj) ? "Documento valido." : "CPF/CNPJ ausente ou invalido.",
    },
    {
      id: "amount",
      label: "Valor",
      ok: Number.isFinite(amount) && amount > 0,
      detail: Number.isFinite(amount) && amount > 0 ? "Valor maior que zero." : "Valor da nota deve ser maior que zero.",
    },
    {
      id: "competence",
      label: "Competencia",
      ok: !!inv.reference_year && !!inv.reference_month,
      detail: inv.reference_year && inv.reference_month ? `${MONTH_NAMES[(inv.reference_month ?? 1) - 1]}/${inv.reference_year}` : "Informe mes e ano de competencia.",
    },
    {
      id: "description",
      label: "Descricao",
      ok: inv.description_body.trim().length >= 15,
      detail: inv.description_body.trim().length >= 15 ? "Descricao suficiente para emissao." : "Descricao muito curta para NFS-e.",
    },
    {
      id: "service",
      label: "Servico",
      ok: Boolean(SERVICE_LABELS[inv.service_type]),
      detail: SERVICE_LABELS[inv.service_type] ? SERVICE_LABELS[inv.service_type] : "Tipo de servico invalido.",
    },
    {
      id: "cep",
      label: "CEP",
      ok: cleanCep.length === 8,
      detail: cleanCep.length === 8 ? "CEP preenchido." : "Informe o CEP do endereco do imovel/tomador.",
    },
    {
      id: "tax",
      label: "Aliquota",
      ok: Number.isFinite(aliquotaNumber) && aliquotaNumber >= 0 && aliquotaNumber <= 100,
      detail: Number.isFinite(aliquotaNumber) && aliquotaNumber >= 0 && aliquotaNumber <= 100 ? `${aliquotaNumber}%` : "Aliquota deve estar entre 0 e 100.",
    },
  ];
}

function operationalStatus(inv: Invoice, checks?: ReadinessCheck[]) {
  const hasDataIssue = checks ? checks.some((check) => !check.ok) : false;
  if (["EMITIDA", "ENVIADA", "PAGA", "CANCELADA", "PROCESSANDO"].includes(inv.status)) {
    return STATUS_CONFIG[inv.status].label;
  }
  if (inv.status === "ERRO" && hasDataIssue) return "Erro de dados";
  if (inv.status === "ERRO") return "Erro de gateway";
  return hasDataIssue ? "Pendente de revisao" : "Pronta para emitir";
}

function findPotentialDuplicates(target: Invoice, all: Invoice[]) {
  return all.filter((inv) => {
    if (inv.id === target.id || inv.status === "CANCELADA") return false;
    const sameTitle = target.title_number && inv.title_number && target.title_number === inv.title_number;
    const sameCore =
      inv.client_cpf_cnpj.replace(/\D/g, "") === target.client_cpf_cnpj.replace(/\D/g, "") &&
      Number(inv.amount) === Number(target.amount) &&
      inv.reference_month === target.reference_month &&
      inv.reference_year === target.reference_year;
    return Boolean(sameTitle || sameCore);
  });
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
  const [emitAliquota, setEmitAliquota] = useState("2");
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
  const autoSyncInFlightRef = useRef(false);
  const runtimeEnv = (process.env.NEXT_PUBLIC_APP_ENV ?? "").toLowerCase();
  const canClearAllDw = ["homolog", "homologacao", "hml"].includes(runtimeEnv);
  const isProductionRuntime = ["production", "prod", "prd"].includes(runtimeEnv);
  const [nfseConfig, setNfseConfig] = useState<NfseCompanyConfig | null>(null);
  const [nfseConfigError, setNfseConfigError] = useState<string | null>(null);
  const nfseEmissionBlocked = isProductionRuntime
    ? nfseConfig?.emissionEnabled !== true
    : nfseConfig?.emissionEnabled === false;
  const nfseEmissionBlockedMessage =
    nfseConfig?.emissionBlockedReason ??
    nfseConfigError ??
    "Validando configuracao fiscal antes de permitir emissao em PRD.";

  // ── Carregar dados ──
  const fetchNfseConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/system/nfse-config");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar configuracao fiscal.");
      setNfseConfig(data);
      setNfseConfigError(null);
    } catch (err) {
      setNfseConfig(null);
      setNfseConfigError(err instanceof Error ? err.message : "Erro ao carregar configuracao fiscal.");
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus)  params.set("status",       filterStatus);
      if (search)        params.set("search",        search);
      if (filterService) params.set("service_type",  filterService);

      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (!res.ok) {
        let message = "Erro ao carregar notas fiscais.";
        try {
          const payload = await res.json() as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          // Mantem mensagem padrao.
        }
        throw new Error(message);
      }
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

  useEffect(() => {
    void fetchNfseConfig();
  }, [fetchNfseConfig]);

  // ── Auto-refresh (polling 30s) ──
  // Roda apenas quando ha notas em PROCESSANDO ou EMITIDA-sem-PDF aguardando webhook.
  // Evita gerar trafego desnecessario quando o usuario nao tem nada pra acompanhar.
  const hasPendingSync = invoices.some(
    (i) => !!i.gateway_id && (i.status === "PROCESSANDO" || (i.status === "EMITIDA" && (!i.gateway_pdf_url || !i.gateway_xml_url)))
  );
  const autoSyncGatewayInvoices = useCallback(async () => {
    const targets = invoices
      .filter((i) => !!i.gateway_id && (i.status === "PROCESSANDO" || (i.status === "EMITIDA" && (!i.gateway_pdf_url || !i.gateway_xml_url))))
      .slice(0, 5);

    if (targets.length === 0 || autoSyncInFlightRef.current) return;

    autoSyncInFlightRef.current = true;
    try {
      await Promise.allSettled(
        targets.map((invoice) => fetch(`/api/invoices/${invoice.id}/sync`, { method: "POST" }))
      );
      await fetchInvoices();
    } finally {
      autoSyncInFlightRef.current = false;
    }
  }, [fetchInvoices, invoices]);
  useEffect(() => {
    if (!hasPendingSync) return;
    void autoSyncGatewayInvoices();
    const interval = setInterval(() => {
      void autoSyncGatewayInvoices();
    }, 30_000);
    return () => clearInterval(interval);
  }, [autoSyncGatewayInvoices, hasPendingSync]);

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
  const attentionCount    = totalErro + overdueCount;
  const readyToEmitCount  = invoices.filter((inv) =>
    ["PENDENTE", "ERRO"].includes(inv.status) &&
    validateInvoiceForEmission(inv, "00000000", "9").every((check) => check.ok)
  ).length;

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

  // ── Sincronizar status com gateway ──
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const syncInvoice = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/invoices/${id}/sync`, { method: "POST" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Erro ao sincronizar.");
      await fetchInvoices();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao sincronizar com o gateway.");
    } finally {
      setSyncingId(null);
    }
  };

  // ── Cancelamento com motivo ──
  // Se a nota tem gateway_id, cancela na prefeitura via API NFE.io.
  // Senao, apenas marca como cancelada no sistema (nota nunca chegou na prefeitura).
  const handleCancelConfirm = async () => {
    if (!cancelModal) return;
    if (!cancelReason.trim() || cancelReason.trim().length < 5) {
      alert("Informe um motivo para cancelar a nota (mínimo 5 caracteres).");
      return;
    }
    setCancelLoading(true);
    try {
      const usePrefeitura = !!cancelModal.gateway_id && cancelModal.status !== "PENDENTE";

      const res = usePrefeitura
        ? await fetch(`/api/invoices/${cancelModal.id}/cancel-prefeitura`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: cancelReason }),
          })
        : await fetch(`/api/invoices/${cancelModal.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "CANCELADA",
              cancelled_at: new Date().toISOString(),
              notes: cancelReason,
            }),
          });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Erro ao cancelar.");
      setCancelModal(null);
      setCancelReason("");
      await fetchInvoices();

      if (usePrefeitura) {
        alert(result.message ?? "Cancelamento solicitado à prefeitura. O status será atualizado quando confirmado.");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao cancelar.");
    } finally {
      setCancelLoading(false);
    }
  };

  // ── Retry em lote (errors recuperaveis) ──
  const [retryingFailed, setRetryingFailed] = useState(false);
  const handleRetryFailed = async () => {
    setRetryingFailed(true);
    try {
      const res = await fetch(`/api/invoices/retry-failed`, { method: "POST" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Erro ao tentar reenvio.");
      await fetchInvoices();
      alert(`Reenvio concluído: ${result.succeeded ?? 0} sucesso(s), ${result.failed ?? 0} falha(s) de ${result.eligible ?? 0} elegível(is) (${result.total_candidates ?? 0} em erro).`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro no reenvio.");
    } finally {
      setRetryingFailed(false);
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
          body: JSON.stringify({ aliquota: 2 }),
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
    if (nfseEmissionBlocked) {
      setEmitError(nfseEmissionBlockedMessage);
      return;
    }
    const checks = validateInvoiceForEmission(emitModal, emitCep, emitAliquota);
    const blockingIssues = checks.filter((check) => !check.ok);
    if (blockingIssues.length > 0) {
      setEmitError(`Revise antes de emitir: ${blockingIssues.map((check) => check.detail).join(" ")}`);
      return;
    }
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

  const handleClearAllDw = async () => {
    setDwCleanupLoading(true);
    setDwCleanupMessage(null);
    try {
      const previewResponse = await fetch("/api/invoices/import-dw?scope=all", { method: "DELETE" });
      const preview = await previewResponse.json().catch(() => ({}));
      if (!previewResponse.ok) throw new Error(preview.error ?? "Falha ao consultar importacoes DW.");

      const removable = Number(preview.removable ?? 0);
      if (removable === 0) {
        setDwCleanupMessage("Nao ha notas DW para remover neste ambiente.");
        return;
      }

      const confirmed = window.confirm(
        `Ambiente de teste: remover TODAS as ${removable} nota(s) importada(s) do DW? Isso permite importar o mesmo arquivo novamente.`
      );
      if (!confirmed) return;

      const cleanupResponse = await fetch("/api/invoices/import-dw?scope=all&dryRun=false", { method: "DELETE" });
      const cleanup = await cleanupResponse.json().catch(() => ({}));
      if (!cleanupResponse.ok) throw new Error(cleanup.error ?? "Falha ao limpar notas DW.");

      setDwCleanupMessage(cleanup.message ?? `${cleanup.deleted ?? 0} nota(s) removida(s).`);
      setSelectedIds(new Set());
      await fetchInvoices();
    } catch (err) {
      setDwCleanupMessage(err instanceof Error ? err.message : "Falha ao limpar notas DW.");
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
    const ISS_RATE = 0.02;

    const mi = invoices.filter(i => i.reference_month === mo && i.reference_year === yr);

    const totalValue   = mi.reduce((s, i) => s + Number(i.amount), 0);
    const paidValue    = mi.filter(i => i.status === "PAGA").reduce((s, i) => s + Number(i.amount), 0);
    const emittedValue = mi.filter(i => ["EMITIDA","ENVIADA"].includes(i.status)).reduce((s, i) => s + Number(i.amount), 0);
    const pendingValue = mi.filter(i => i.status === "PENDENTE").reduce((s, i) => s + Number(i.amount), 0);
    const issTotal     = totalValue * ISS_RATE;
    const errorCount    = mi.filter(i => i.status === "ERRO").length;
    const cancelledCount = mi.filter(i => i.status === "CANCELADA").length;
    const importedDwCount = mi.filter(i => i.imported_from_dw).length;
    const gatewayReadyCount = mi.filter(i => i.gateway_id || i.gateway_status || i.gateway_pdf_url || i.gateway_xml_url).length;

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
    <p>Imobiliária Jardim do Lago — Auxiliadora Predial</p>
    <div class="header-meta">
      <div class="meta-item"><label>Competência</label><span>${monthName}/${yr}</span></div>
      <div class="meta-item"><label>Total de notas</label><span>${mi.length}</span></div>
      <div class="meta-item"><label>Gerado em</label><span>${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span></div>
      <div class="meta-item"><label>Alíquota ISS</label><span>2% (ISS Canoas)</span></div>
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
      <h3>ISS — Imposto Sobre Serviços (2% Canoas)</h3>
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
      <div class="section-title">Resumo Operacional</div>
      <table>
        <tbody>
          <tr><td>Notas pendentes de emissao</td><td style="text-align:right;font-weight:700">${mi.filter(i => i.status === "PENDENTE").length}</td></tr>
          <tr><td>Notas com erro de emissao</td><td style="text-align:right;font-weight:700;color:#dc2626">${errorCount}</td></tr>
          <tr><td>Notas canceladas</td><td style="text-align:right;font-weight:700;color:#6b7280">${cancelledCount}</td></tr>
          <tr><td>Notas importadas do DW</td><td style="text-align:right;font-weight:700;color:#1d4ed8">${importedDwCount}</td></tr>
          <tr><td>Notas com retorno/ID do gateway</td><td style="text-align:right;font-weight:700;color:#4338ca">${gatewayReadyCount}</td></tr>
          <tr><td>ISS estimado total</td><td style="text-align:right;font-weight:700;color:#1d4ed8">${fmt(issTotal)}</td></tr>
        </tbody>
      </table>
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
    <p><strong>Imobiliária Jardim do Lago</strong> — Relatório gerado automaticamente pelo sistema de gestão</p>
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

  const emitChecks = emitModal ? validateInvoiceForEmission(emitModal, emitCep, emitAliquota) : [];
  const emitReady = emitChecks.length > 0 && emitChecks.every((check) => check.ok);
  const emitDuplicates = emitModal ? findPotentialDuplicates(emitModal, invoices) : [];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Fiscal</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">Notas Fiscais</h1>
            <p className="mt-1 text-sm text-gray-500">Revisao, emissao e acompanhamento de NFS-e importadas do DW.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchInvoices}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              title={hasPendingSync ? "Atualizar (auto-refresh ativo a cada 30s)" : "Atualizar"}
            >
              <RefreshCw className={cn("h-4 w-4", hasPendingSync && "animate-pulse text-blue-500")} />
            </button>
            <button
              onClick={() => { setImportModal(true); resetImport(); }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Importar DW
            </button>
          </div>
        </div>

        {nfseEmissionBlocked && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-semibold">Emissao fiscal bloqueada em PRD</p>
                <p className="mt-0.5 text-xs">{nfseEmissionBlockedMessage}</p>
                {nfseConfig?.pendingProductionFields?.length ? (
                  <p className="mt-1 text-xs">Pendencias: {nfseConfig.pendingProductionFields.join(", ")}</p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {nfseConfigError && isProductionRuntime && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-semibold">Nao foi possivel validar a configuracao fiscal.</p>
                <p className="mt-0.5 text-xs">{nfseConfigError}</p>
              </div>
            </div>
          </div>
        )}

        {dwCleanupMessage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {dwCleanupMessage}
          </div>
        )}

        <section className="rounded-xl border border-gray-200 bg-white">
          <div className="grid grid-cols-1 divide-y divide-gray-100 md:grid-cols-[1.1fr_0.9fr] md:divide-x md:divide-y-0">
            <div className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Fila de emissao</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {readyToEmitCount > 0
                      ? `${readyToEmitCount} nota(s) pronta(s) para emitir.`
                      : "Revise as pendencias antes de emitir."}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-gray-950">{summary?.pendentes ?? 0}</p>
                  <p className="text-xs text-gray-400">pendente(s)</p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${invoices.length > 0 ? Math.min(100, ((summary?.pagas ?? 0) / invoices.length) * 100) : 0}%` }}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-gray-400">A emitir</p>
                  <p className="mt-1 text-sm font-semibold text-amber-700">{formatCurrency(totalPendente)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Emitido/enviado</p>
                  <p className="mt-1 text-sm font-semibold text-indigo-700">{formatCurrency(totalEmitido)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Recebido</p>
                  <p className="mt-1 text-sm font-semibold text-green-700">{formatCurrency(totalPago)}</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm font-semibold text-gray-900">Atencao operacional</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab("erro")}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    totalErro > 0 ? "border-red-200 bg-red-50 hover:bg-red-100" : "border-gray-200 bg-gray-50"
                  )}
                >
                  <p className={cn("text-xl font-semibold", totalErro > 0 ? "text-red-700" : "text-gray-400")}>{totalErro}</p>
                  <p className="text-xs text-gray-500">erro(s) de emissao</p>
                </button>
                <button
                  onClick={() => setActiveTab("vencidas")}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    overdueCount > 0 ? "border-orange-200 bg-orange-50 hover:bg-orange-100" : "border-gray-200 bg-gray-50"
                  )}
                >
                  <p className={cn("text-xl font-semibold", overdueCount > 0 ? "text-orange-700" : "text-gray-400")}>{overdueCount}</p>
                  <p className="text-xs text-gray-500">vencida(s)</p>
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {totalErro > 0 && (
                  <button
                    onClick={handleRetryFailed}
                    disabled={retryingFailed}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {retryingFailed
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Reenviando...</>
                      : <><AlertTriangle className="h-3 w-3" /> Reenviar erros</>}
                  </button>
                )}
                <button
                  onClick={handleClearPendingDw}
                  disabled={dwCleanupLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  {dwCleanupLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Limpar DW pendente
                </button>
                {canClearAllDw && (
                  <button
                    onClick={handleClearAllDw}
                    disabled={dwCleanupLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    title="Disponivel apenas fora de production"
                  >
                    {dwCleanupLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                    Limpar DW teste
                  </button>
                )}
                <button
                  onClick={() => setReportModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <FileText className="h-3 w-3" />
                  Relatorio
                </button>
                <button
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  Exportar
                </button>
                <button
                  onClick={() => { setManualModal(true); setManualForm(EMPTY_MANUAL_FORM); setManualError(null); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Plus className="h-3 w-3" />
                  Nova nota
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit flex-wrap">
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
          <div className="text-xs text-gray-400">
            {attentionCount > 0 ? `${attentionCount} item(ns) precisam de atencao` : "Operacao sem alertas criticos"}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente, CPF/CNPJ ou endereco"
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
            <option value="">Todos os servicos</option>
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
                  const rowChecks = validateInvoiceForEmission(inv, "00000000", "9");
                  const rowOperationalStatus = operationalStatus(inv, rowChecks);

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
                          <p className="mt-1 text-[10px] text-gray-400">{rowOperationalStatus}</p>
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {/* Emitir */}
                            {(inv.status === "PENDENTE" || inv.status === "ERRO") && (
                              <button
                                onClick={() => { setEmitModal(inv); setEmitError(null); setEmitCep(""); setEmitAliquota("2"); setCepResults([]); }}
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
                            {/* Sincronizar com gateway */}
                            {inv.gateway_id && ["PROCESSANDO","ERRO","EMITIDA"].includes(inv.status) && (
                              <button
                                onClick={() => syncInvoice(inv.id)}
                                disabled={syncingId === inv.id}
                                className="p-1.5 border border-blue-200 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
                                title="Sincronizar status com NFE.io"
                              >
                                {syncingId === inv.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <RefreshCw className="h-3.5 w-3.5" />}
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
                            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-4">
                              <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-semibold text-gray-900">{invoiceCode(inv)}</h3>
                                    <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border", st.color)}>
                                      <StatusIcon className={cn("h-3 w-3", inv.status === "PROCESSANDO" && "animate-spin")} />
                                      {st.label}
                                    </span>
                                    {overdue && (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700">
                                        <Clock className="h-3 w-3" />
                                        Vencida
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-xs text-gray-500">{operationMessage(inv)}</p>
                                </div>

                                {inv.gateway_id && ["PROCESSANDO", "ERRO", "EMITIDA"].includes(inv.status) && (
                                  <button
                                    onClick={() => syncInvoice(inv.id)}
                                    disabled={syncingId === inv.id}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                                  >
                                    {syncingId === inv.id
                                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando</>
                                      : <><RefreshCw className="h-3.5 w-3.5" /> Sincronizar NFE.io</>}
                                  </button>
                                )}
                              </div>

                              {inv.status === "ERRO" && (
                                <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                                  {(() => {
                                    const explained = explainEmitError(inv.last_emit_error);
                                    return (
                                      <div className="flex gap-3">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold text-red-900">{explained.title}</p>
                                          <p className="mt-0.5 text-xs text-red-700">{explained.action}</p>
                                          {inv.last_emit_error && (
                                            <details className="mt-2">
                                              <summary className="cursor-pointer text-[11px] font-medium text-red-700">Ver detalhe tecnico</summary>
                                              <p className="mt-1 break-words rounded bg-white/70 p-2 font-mono text-[11px] text-red-700">{inv.last_emit_error}</p>
                                            </details>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                              <div className="grid gap-0 border-b border-gray-100 md:grid-cols-4">
                                <div className="border-b border-gray-100 px-4 py-3 md:border-b-0 md:border-r">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Cliente</p>
                                  <p className="mt-1 truncate text-xs font-semibold text-gray-900">{inv.client_name}</p>
                                  <p className="mt-0.5 font-mono text-[11px] text-gray-500">{maskSensitiveCpfCnpj(inv.client_cpf_cnpj)}</p>
                                </div>
                                <div className="border-b border-gray-100 px-4 py-3 md:border-b-0 md:border-r">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Servico</p>
                                  <p className="mt-1 text-xs font-semibold text-gray-900">{SERVICE_LABELS[inv.service_type]}</p>
                                  <p className="mt-0.5 text-[11px] text-gray-500">
                                    {inv.reference_month ? MONTH_NAMES[inv.reference_month - 1] : "Sem mes"} / {inv.reference_year}
                                  </p>
                                </div>
                                <div className="border-b border-gray-100 px-4 py-3 md:border-b-0 md:border-r">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Valor</p>
                                  <p className="mt-1 text-xs font-semibold text-gray-900">{formatCurrency(Number(inv.amount))}</p>
                                  <p className={cn("mt-0.5 text-[11px]", overdue ? "text-orange-600" : "text-gray-500")}>
                                    Vencimento {inv.due_date ? formatDate(inv.due_date) : "nao informado"}
                                  </p>
                                </div>
                                <div className="px-4 py-3">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Gateway</p>
                                  <p className="mt-1 text-xs font-semibold text-gray-900">{inv.gateway_provider || "Aguardando emissao"}</p>
                                  <p className="mt-0.5 text-[11px] text-gray-500">
                                    {inv.emit_attempts} tentativa(s){inv.last_emit_at ? ` · ${formatDate(inv.last_emit_at)}` : ""}
                                  </p>
                                </div>
                              </div>

                              <div className="grid gap-4 p-4 lg:grid-cols-[0.9fr_1.1fr]">
                                <div>
                                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Historico</p>
                                  <div className="space-y-3">
                                    {buildInvoiceTimeline(inv).map((event, index) => (
                                      <div key={`${event.label}-${index}`} className="flex gap-3">
                                        <div className={cn(
                                          "mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full",
                                          event.tone === "green" && "bg-green-500",
                                          event.tone === "red" && "bg-red-500",
                                          event.tone === "amber" && "bg-amber-500",
                                          event.tone === "purple" && "bg-purple-500",
                                          event.tone === "blue" && "bg-blue-500",
                                          event.tone === "gray" && "bg-gray-400",
                                        )} />
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-gray-900">{event.label}</p>
                                          <p className="text-[11px] text-gray-500">{event.detail}</p>
                                          <p className="text-[11px] text-gray-400">{event.date ? formatDate(event.date) : "Data nao registrada"}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <details open className="rounded-lg border border-gray-200 bg-gray-50/70">
                                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-700">Descricao da NFS-e</summary>
                                    <div className="border-t border-gray-200 px-3 py-2">
                                      <p className="text-xs leading-relaxed text-gray-600">{inv.description_body}</p>
                                    </div>
                                  </details>

                                  <details className="rounded-lg border border-gray-200 bg-white">
                                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-700">Dados importados do DW</summary>
                                    <div className="grid gap-3 border-t border-gray-100 px-3 py-3 text-xs sm:grid-cols-2">
                                      <div>
                                        <p className="text-gray-400">Codigo do imovel</p>
                                        <p className="font-mono text-gray-700">{inv.property_code || "-"}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-400">Titulo DW</p>
                                        <p className="font-mono text-gray-700">{inv.title_number || "-"}</p>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <p className="text-gray-400">Endereco do imovel</p>
                                        <p className="font-medium text-gray-700">{inv.property_address || "-"}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-400">Agencia</p>
                                        <p className="font-medium text-gray-700">{inv.dw_agency_name || "-"}</p>
                                      </div>
                                      {inv.notes && (
                                        <div className="sm:col-span-2">
                                          <p className="text-gray-400">Observacoes</p>
                                          <p className="text-gray-700">{inv.notes}</p>
                                        </div>
                                      )}
                                    </div>
                                  </details>

                                  <details className="rounded-lg border border-gray-200 bg-white">
                                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-700">Dados tecnicos do gateway</summary>
                                    <div className="grid gap-3 border-t border-gray-100 px-3 py-3 text-xs sm:grid-cols-2">
                                      <div>
                                        <p className="text-gray-400">Provider</p>
                                        <p className="font-mono text-gray-700">{inv.gateway_provider || "-"}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-400">Status gateway</p>
                                        <p className="font-mono text-gray-700">{inv.gateway_status || "-"}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-400">Tentativas</p>
                                        <p className="font-medium text-gray-700">{inv.emit_attempts}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-400">Ultima tentativa</p>
                                        <p className="font-medium text-gray-700">{inv.last_emit_at ? formatDate(inv.last_emit_at) : "-"}</p>
                                      </div>
                                      {inv.gateway_id && (
                                        <div className="sm:col-span-2">
                                          <p className="text-gray-400">ID no gateway</p>
                                          <p className="break-all font-mono text-gray-700">{inv.gateway_id}</p>
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                </div>
                              </div>
                            </div>
                            <details className="rounded-lg border border-gray-200 bg-white mb-4">
                              <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-gray-600">Ver auditoria e dados completos</summary>
                              <div className="border-t border-gray-100 p-4">
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
                                  {inv.gateway_id && ["PROCESSANDO","ERRO","EMITIDA"].includes(inv.status) && (
                                    <button
                                      onClick={() => syncInvoice(inv.id)}
                                      disabled={syncingId === inv.id}
                                      className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                                    >
                                      {syncingId === inv.id
                                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Sincronizando...</>
                                        : <><RefreshCw className="h-3 w-3" /> Sincronizar com NFE.io</>}
                                    </button>
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

                            {/* Comprovante oficial — destaque quando nota foi emitida */}
                              </div>
                            </details>

                            {inv.status === "EMITIDA" && (inv.gateway_pdf_url || inv.gateway_xml_url || inv.nfse_number) && (
                              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 mb-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 p-2 bg-green-600 rounded-lg">
                                    <CheckCircle2 className="h-5 w-5 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-green-900">NFS-e emitida pela Prefeitura</p>
                                    <p className="text-xs text-green-700 mt-0.5">
                                      {inv.nfse_number ? `Número oficial: ${inv.nfse_number}` : "Documento fiscal oficial disponível"}
                                      {inv.issued_at && ` · Emitida em ${formatDate(inv.issued_at)}`}
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                      {inv.gateway_pdf_url && (
                                        <a href={inv.gateway_pdf_url} target="_blank" rel="noopener noreferrer"
                                          download
                                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                                          <Download className="h-3.5 w-3.5" />Baixar DANFE (PDF)
                                        </a>
                                      )}
                                      {inv.gateway_xml_url && (
                                        <a href={inv.gateway_xml_url} target="_blank" rel="noopener noreferrer"
                                          download
                                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors">
                                          <FileText className="h-3.5 w-3.5" />XML Fiscal
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Aguardando processamento da prefeitura */}
                            {inv.status === "EMITIDA" && !inv.gateway_pdf_url && !inv.nfse_number && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                                <p className="text-xs text-amber-800">
                                  Nota enviada ao gateway. Aguardando processamento da Prefeitura para liberar o comprovante oficial.
                                  {inv.gateway_id && (
                                    <button onClick={() => syncInvoice(inv.id)} disabled={syncingId === inv.id}
                                      className="ml-2 underline font-medium hover:text-amber-900 disabled:opacity-50">
                                      {syncingId === inv.id ? "Verificando..." : "Verificar agora"}
                                    </button>
                                  )}
                                </p>
                              </div>
                            )}

                            {/* Erro de emissão — destaque */}
                            {inv.status === "ERRO" && (
                              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 p-2 bg-red-600 rounded-lg">
                                    <AlertTriangle className="h-5 w-5 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-red-900">Falha na emissão da NFS-e</p>
                                    {inv.last_emit_error && (
                                      <p className="text-xs text-red-700 font-mono mt-1 bg-white/60 rounded p-2 break-words">{inv.last_emit_error}</p>
                                    )}
                                    {inv.emit_attempts > 0 && (
                                      <p className="text-[11px] text-red-600 mt-1">{inv.emit_attempts} tentativa(s) realizadas</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {inv.last_emit_error && inv.status !== "ERRO" && (
                              <div className="text-xs bg-red-50 border border-red-100 rounded-lg p-2 mb-2">
                                <p className="text-red-500 font-medium mb-0.5">Última mensagem do gateway:</p>
                                <p className="text-red-600 font-mono">{inv.last_emit_error}</p>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl">
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
              <InvoiceVisualPreview invoice={emitModal} cep={emitCep} aliquota={emitAliquota} />
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Checklist antes da emissao</p>
                    <p className="text-xs text-gray-500">A nota so pode ser emitida quando todos os itens estiverem validos.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmitError(emitReady ? null : `Pendencias: ${emitChecks.filter((check) => !check.ok).map((check) => check.detail).join(" ")}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Revalidar nota
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {emitChecks.map((check) => (
                    <div
                      key={check.id}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                        check.ok ? "bg-green-50 border-green-100 text-green-800" : "bg-red-50 border-red-100 text-red-800"
                      )}
                    >
                      {check.ok ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />}
                      <div>
                        <p className="font-semibold">{check.label}</p>
                        <p className={check.ok ? "text-green-700" : "text-red-700"}>{check.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {emitDuplicates.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-xs text-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Possivel duplicidade encontrada</p>
                      <p className="mt-1">
                        Existe(m) {emitDuplicates.length} nota(s) com mesmo titulo DW ou mesmo cliente, valor e competencia.
                        Revise antes de emitir para evitar duplicidade fiscal.
                      </p>
                      <div className="mt-2 space-y-1">
                        {emitDuplicates.slice(0, 3).map((dup) => (
                          <p key={dup.id} className="font-mono text-amber-900">
                            {invoiceCode(dup)} - {dup.client_name} - {formatCurrency(Number(dup.amount))} - {STATUS_CONFIG[dup.status].label}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                  <label className="text-gray-400 mb-0.5 block">Alíquota ISS (%)</label>
                  <input
                    type="number" min="0" max="100" step="0.5" value={emitAliquota}
                    onChange={(e) => setEmitAliquota(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="text-xs">
                <p className="text-gray-400 mb-0.5">Descrição da NFS-e</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Descricao que sera enviada ao gateway</p>
                  <p className="text-gray-700 mt-1 leading-relaxed">{emitModal.description_body}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] text-gray-500">
                    <p>Servico: <span className="font-medium text-gray-800">{SERVICE_LABELS[emitModal.service_type]}</span></p>
                    <p>Competencia: <span className="font-medium text-gray-800">{emitModal.reference_month ? `${MONTH_NAMES[emitModal.reference_month - 1]}/${emitModal.reference_year}` : emitModal.reference_year}</span></p>
                    <p>Valor: <span className="font-medium text-gray-800">{formatCurrency(Number(emitModal.amount))}</span></p>
                    <p>Tomador: <span className="font-medium text-gray-800">{emitModal.client_name}</span></p>
                  </div>
                </div>
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
                      ["Município de incidência", "Canoas – RS"],
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
              {process.env.NEXT_PUBLIC_APP_ENV !== "production" && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <p>Ambiente de homologação — emissões são enviadas ao sandbox do gateway e <strong>não geram notas fiscais reais</strong>.</p>
              </div>
              )}
              {nfseEmissionBlocked && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">PRD preparado, mas emissao real bloqueada.</p>
                    <p className="mt-0.5">{nfseEmissionBlockedMessage}</p>
                  </div>
                </div>
              )}
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
              {!emitReady && (
                <p className="mr-auto text-xs font-medium text-red-600">Resolva as pendencias do checklist para emitir.</p>
              )}
              {nfseEmissionBlocked && (
                <p className="mr-auto text-xs font-medium text-amber-700">Emissao em PRD bloqueada ate confirmacao fiscal.</p>
              )}
              <button onClick={() => setEmitModal(null)} disabled={emitting} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50">Cancelar</button>
              <button
                onClick={handleEmit} disabled={emitting || !emitReady || nfseEmissionBlocked}
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
