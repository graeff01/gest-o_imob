"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  Bot,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Paperclip,
  ArrowRight,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Receipt,
  CreditCard,
  Edit3,
  PenLine,
  ChevronDown,
  X,
  Send,
  Plus,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  type AIExtractionResult,
  type DocumentType,
  getDestinoLabel,
  getDocTypeColor,
  getDocTypeLabel,
} from "@/lib/utils/ai-processor";

// ─── Constants ─────────────────────────────────────

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "DESPESA", label: "Despesa" },
  { value: "RECEITA", label: "Receita" },
  { value: "NOTA_FISCAL", label: "Nota Fiscal" },
  { value: "EXTRATO_BANCARIO", label: "Extrato Bancário" },
  { value: "COMISSAO", label: "Comissão" },
  { value: "IMPOSTO", label: "Imposto/Tributo" },
  { value: "COMPROVANTE_PIX", label: "Comprovante PIX" },
  { value: "CONTRATO", label: "Contrato" },
  { value: "OUTROS", label: "Outros" },
];

const CATEGORIAS_DESPESA = [
  "Contas de Consumo", "Material", "Manutenção", "Contas Operacionais Venda",
  "Contas Operacionais Locação", "Folha de Pagamentos", "Tarifas Bancárias",
  "Impostos e Tributos", "Gastos Espaço Físico", "Marketing",
];

const SUBCATEGORIAS: Record<string, string[]> = {
  "Contas de Consumo": ["Luz/Energia", "Água", "Telefone/Internet", "Gás", "Condomínio escritório"],
  "Material": ["Escritório", "Limpeza", "Copa/Cozinha", "Informática", "Impressão"],
  "Manutenção": ["Predial", "Equipamentos", "Ar condicionado", "Elétrica", "Hidráulica", "Pintura"],
  "Contas Operacionais Venda": ["Publicidade venda", "Placas", "Fotos imóveis", "CRECI", "Cartório"],
  "Contas Operacionais Locação": ["Publicidade locação", "Placas locação", "Vistorias", "Seguros", "Marketing digital"],
  "Folha de Pagamentos": ["Salários locação", "Salários venda", "Comissões locação", "Comissões venda", "FGTS", "INSS", "Vale transporte", "Vale refeição"],
  "Tarifas Bancárias": ["Manutenção conta", "DOC/TED", "Boletos emitidos", "Anuidade cartão", "Juros/Multas"],
  "Impostos e Tributos": ["ISS", "IRPJ", "CSLL", "PIS", "COFINS", "IPTU escritório", "Alvará", "Simples Nacional"],
  "Gastos Espaço Físico": ["Aluguel escritório", "Condomínio", "IPTU", "Seguro predial", "Limpeza terceirizada"],
  "Marketing": ["Marketing digital", "Impulsionamento", "Material impresso", "Eventos"],
};

const CATEGORIAS_RECEITA = [
  "Intermediação", "Agenciamento", "Administração", "NFSe Aluguel",
  "Campanha Sucesso", "Multa Contratual", "Outro",
];

const DESTINOS = [
  { value: "expenses", label: "Despesas (Financeiro)" },
  { value: "revenues", label: "Receitas (Financeiro)" },
  { value: "invoices", label: "Notas Fiscais" },
  { value: "bank_transactions", label: "Extratos Bancários" },
  { value: "manual", label: "Classificação Manual" },
];

const DESTINO_ICONS: Record<string, React.ElementType> = {
  expenses: TrendingDown,
  revenues: TrendingUp,
  invoices: Receipt,
  bank_transactions: CreditCard,
  manual: FileText,
};

// ─── Types ─────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  file?: { name: string; size: number; type: string };
  extraction?: AIExtractionResult;
  status?: "processing" | "success" | "error" | "confirmed";
  editing?: boolean;
}

type ViewMode = "chat" | "manual";

// ─── Component ─────────────────────────────────────

export default function CentralIAPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Manual entry state
  const [manualForm, setManualForm] = useState<Partial<AIExtractionResult>>({
    tipo_documento: "DESPESA",
    valor: 0,
    data_documento: new Date().toLocaleDateString("pt-BR"),
    descricao: "",
    emissor_nome: "",
    emissor_cnpj_cpf: "",
    categoria_sugerida: "",
    subcategoria_sugerida: "",
    departamento: "AMBOS",
    destino: "expenses",
    destino_descricao: "",
    confianca: 100,
    observacoes: "Inserção manual",
  });

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  const addMessage = useCallback(
    (msg: Omit<ChatMessage, "id" | "timestamp">) => {
      const newMsg = { ...msg, id: crypto.randomUUID(), timestamp: new Date() };
      setMessages((prev) => [...prev, newMsg]);
      scrollToBottom();
      return newMsg.id;
    },
    [scrollToBottom]
  );

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }, []);

  // ─── Process File ────────────────────────────────

  const processFile = async (file: File) => {
    if (isProcessing) return;
    setViewMode("chat");

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      addMessage({ role: "assistant", content: `Formato não suportado. Envie JPG, PNG, WebP ou PDF.`, status: "error" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      addMessage({ role: "assistant", content: "Arquivo muito grande (max 20MB).", status: "error" });
      return;
    }

    addMessage({
      role: "user",
      content: file.name,
      file: { name: file.name, size: file.size, type: file.type },
    });

    const processingId = addMessage({ role: "assistant", content: "Analisando documento com IA...", status: "processing" });
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const result = await res.json();

      if (!result.success) {
        updateMessage(processingId, { content: `Erro: ${result.error || "Falha desconhecida"}`, status: "error" });
        return;
      }

      updateMessage(processingId, {
        content: `Documento analisado (${result.mode === "ai" ? "GPT-4o" : "mock"})`,
        extraction: result.data as AIExtractionResult,
        status: "success",
      });
    } catch {
      updateMessage(processingId, { content: "Erro de conexão. Tente novamente.", status: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Confirm & Route ────────────────────────────

  const confirmAndRoute = async (messageId: string, extraction: AIExtractionResult) => {
    updateMessage(messageId, { status: "confirmed", editing: false });

    const confirmId = addMessage({ role: "assistant", content: "Lançando no sistema...", status: "processing" });

    try {
      const res = await fetch("/api/process-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraction }),
      });
      const result = await res.json();

      if (result.success) {
        updateMessage(confirmId, {
          content: `Lançado com sucesso em ${getDestinoLabel(extraction.destino)}!`,
          status: "success",
        });
      } else {
        updateMessage(confirmId, { content: `Erro ao lançar: ${result.error}`, status: "error" });
      }
    } catch {
      updateMessage(confirmId, { content: "Erro de conexão ao lançar.", status: "error" });
    }
  };

  // ─── Manual Submit ───────────────────────────────

  const handleManualSubmit = async () => {
    if (!manualForm.descricao || !manualForm.valor) return;

    const extraction = { ...manualForm } as AIExtractionResult;

    addMessage({ role: "user", content: `Inserção manual: ${manualForm.descricao}` });
    const confirmId = addMessage({ role: "assistant", content: "Lançando registro manual...", status: "processing" });

    try {
      const res = await fetch("/api/process-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraction }),
      });
      const result = await res.json();

      if (result.success) {
        updateMessage(confirmId, {
          content: `Registro manual lançado em ${getDestinoLabel(extraction.destino)}!`,
          status: "success",
        });
        setManualForm({
          tipo_documento: "DESPESA", valor: 0, data_documento: new Date().toLocaleDateString("pt-BR"),
          descricao: "", emissor_nome: "", emissor_cnpj_cpf: "", categoria_sugerida: "",
          subcategoria_sugerida: "", departamento: "AMBOS", destino: "expenses",
          destino_descricao: "", confianca: 100, observacoes: "Inserção manual",
        });
        setViewMode("chat");
      } else {
        updateMessage(confirmId, { content: `Erro: ${result.error}`, status: "error" });
      }
    } catch {
      updateMessage(confirmId, { content: "Erro de conexão.", status: "error" });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const processedCount = messages.filter((m) => m.status === "success" || m.status === "confirmed").length;

  // ─── Render ──────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Central IA</h1>
          <p className="text-xs text-gray-500">Ponto único de entrada de dados do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("chat")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              viewMode === "chat" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <Upload className="h-3.5 w-3.5 inline mr-1.5" />Upload IA
          </button>
          <button
            onClick={() => setViewMode("manual")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              viewMode === "manual" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <PenLine className="h-3.5 w-3.5 inline mr-1.5" />Manual
          </button>
          {processedCount > 0 && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded-full ml-1">
              {processedCount} processados
            </span>
          )}
        </div>
      </div>

      {/* ═══ MANUAL ENTRY MODE ═══ */}
      {viewMode === "manual" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <PenLine className="h-5 w-5 text-blue-600" />
                <h2 className="font-semibold text-gray-900">Inserção Manual</h2>
                <span className="text-xs text-gray-400 ml-auto">Preencha os campos abaixo</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Documento</label>
                  <select value={manualForm.tipo_documento} onChange={(e) => {
                    const tipo = e.target.value as DocumentType;
                    setManualForm({ ...manualForm, tipo_documento: tipo,
                      destino: tipo === "RECEITA" || tipo === "COMISSAO" ? "revenues" : tipo === "NOTA_FISCAL" ? "invoices" : tipo === "EXTRATO_BANCARIO" ? "bank_transactions" : "expenses",
                    });
                  }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    {DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Departamento</label>
                  <select value={manualForm.departamento} onChange={(e) => setManualForm({ ...manualForm, departamento: e.target.value as "LOCACAO" | "VENDA" | "AMBOS" })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="LOCACAO">Locação</option>
                    <option value="VENDA">Venda</option>
                    <option value="AMBOS">Ambos</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor (R$) *</label>
                  <input type="number" step="0.01" value={manualForm.valor || ""} onChange={(e) => setManualForm({ ...manualForm, valor: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                  <input type="text" value={manualForm.data_documento} onChange={(e) => setManualForm({ ...manualForm, data_documento: e.target.value })}
                    placeholder="DD/MM/AAAA" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descrição *</label>
                <input type="text" value={manualForm.descricao} onChange={(e) => setManualForm({ ...manualForm, descricao: e.target.value })}
                  placeholder="Ex: Conta de energia do escritório" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Emissor / Fornecedor</label>
                  <input type="text" value={manualForm.emissor_nome} onChange={(e) => setManualForm({ ...manualForm, emissor_nome: e.target.value })}
                    placeholder="Nome" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CPF/CNPJ</label>
                  <input type="text" value={manualForm.emissor_cnpj_cpf} onChange={(e) => setManualForm({ ...manualForm, emissor_cnpj_cpf: e.target.value })}
                    placeholder="XX.XXX.XXX/XXXX-XX" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
                  <select value={manualForm.categoria_sugerida} onChange={(e) => setManualForm({ ...manualForm, categoria_sugerida: e.target.value, subcategoria_sugerida: "" })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">Selecione...</option>
                    {(manualForm.tipo_documento === "RECEITA" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subcategoria</label>
                  <select value={manualForm.subcategoria_sugerida} onChange={(e) => setManualForm({ ...manualForm, subcategoria_sugerida: e.target.value })}
                    disabled={!manualForm.categoria_sugerida || !SUBCATEGORIAS[manualForm.categoria_sugerida || ""]}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400">
                    <option value="">Selecione...</option>
                    {(SUBCATEGORIAS[manualForm.categoria_sugerida || ""] || []).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Destino no Sistema</label>
                <select value={manualForm.destino} onChange={(e) => setManualForm({ ...manualForm, destino: e.target.value as AIExtractionResult["destino"] })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  {DESTINOS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setViewMode("chat")}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleManualSubmit}
                  disabled={!manualForm.descricao || !manualForm.valor}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <Send className="h-4 w-4" />
                  Lançar no Sistema
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CHAT / UPLOAD MODE ═══ */}
      {viewMode === "chat" && (
        <>
          <div
            className={cn(
              "flex-1 overflow-y-auto transition-colors rounded-xl",
              dragOver && "bg-blue-50/50 ring-2 ring-blue-300 ring-inset"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {/* Empty state / Drop zone */}
            {dragOver ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Upload className="h-12 w-12 text-blue-400 mx-auto mb-3 animate-bounce" />
                  <p className="text-blue-600 font-medium">Solte o arquivo aqui</p>
                  <p className="text-xs text-blue-400 mt-1">JPG, PNG, WebP ou PDF (max 20MB)</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="h-10 w-10 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mb-2">Envie seu primeiro documento</h2>
                  <p className="text-sm text-gray-500 mb-6">
                    A IA vai analisar, classificar e lançar automaticamente na aba correta do sistema.
                    Você poderá revisar e corrigir antes de confirmar.
                  </p>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30"
                  >
                    <Upload className="h-5 w-5" />
                    Enviar Documento
                  </button>

                  <p className="text-[11px] text-gray-400 mt-4">
                    Ou arraste e solte na tela &middot; JPG, PNG, WebP, PDF (max 20MB)
                  </p>

                  <div className="flex items-center justify-center gap-3 mt-6">
                    {[
                      { icon: TrendingDown, label: "Despesas", color: "text-red-400 bg-red-50" },
                      { icon: TrendingUp, label: "Receitas", color: "text-green-400 bg-green-50" },
                      { icon: Receipt, label: "Notas Fiscais", color: "text-blue-400 bg-blue-50" },
                      { icon: CreditCard, label: "Extratos", color: "text-purple-400 bg-purple-50" },
                      { icon: FileText, label: "Contratos", color: "text-indigo-400 bg-indigo-50" },
                    ].map((t) => (
                      <div key={t.label} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium", t.color)}>
                        <t.icon className="h-3.5 w-3.5" /> {t.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Message list */
              <div className="space-y-4 py-2">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}

                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-md"
                        : "bg-white border border-gray-200 text-gray-700 rounded-bl-md shadow-sm"
                    )}>
                      {/* Processing */}
                      {msg.status === "processing" && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{msg.content}</span>
                        </div>
                      )}

                      {/* Error */}
                      {msg.status === "error" && (
                        <div className="flex items-start gap-2 text-red-600">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{msg.content}</span>
                        </div>
                      )}

                      {/* User file */}
                      {msg.file && (
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="font-medium">{msg.file.name}</span>
                          <span className="text-[10px] opacity-70">({(msg.file.size / 1024).toFixed(0)}KB)</span>
                        </div>
                      )}

                      {/* Normal text */}
                      {!msg.status && !msg.extraction && !msg.file && <p>{msg.content}</p>}

                      {/* Confirmed */}
                      {msg.status === "confirmed" && msg.extraction && (
                        <div className="space-y-1 opacity-60">
                          <div className="flex items-center gap-2 text-green-600 text-xs font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Confirmado e lançado
                          </div>
                          <CompactCard data={msg.extraction} />
                        </div>
                      )}

                      {/* Success with extraction — editable */}
                      {msg.status === "success" && msg.extraction && (
                        msg.editing ? (
                          <EditableExtraction
                            data={msg.extraction}
                            onSave={(updated) => {
                              updateMessage(msg.id, { extraction: updated, editing: false });
                            }}
                            onCancel={() => updateMessage(msg.id, { editing: false })}
                            onConfirm={(updated) => confirmAndRoute(msg.id, updated)}
                          />
                        ) : (
                          <div className="space-y-3">
                            <ExtractionCard data={msg.extraction} />
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                              <button onClick={() => confirmAndRoute(msg.id, msg.extraction!)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar e Lançar
                              </button>
                              <button onClick={() => updateMessage(msg.id, { editing: true })}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">
                                <Edit3 className="h-3.5 w-3.5" /> Corrigir
                              </button>
                              <button onClick={() => updateMessage(msg.id, { status: undefined, extraction: undefined, content: "Documento descartado." })}
                                className="px-3 py-1.5 text-gray-400 rounded-lg text-xs hover:text-red-500 transition-colors ml-auto">
                                Descartar
                              </button>
                            </div>
                          </div>
                        )
                      )}

                      {/* Success without extraction */}
                      {msg.status === "success" && !msg.extraction && (
                        <div className="flex items-start gap-2 text-green-700">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{msg.content}</span>
                        </div>
                      )}

                      <p className={cn("text-[10px] mt-1.5", msg.role === "user" ? "text-blue-200" : "text-gray-300")}>
                        {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>

                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                        <User className="h-4 w-4 text-gray-600" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Bottom bar — only when messages exist */}
          {messages.length > 0 && (
            <div className="border-t border-gray-200 pt-3 pb-1 flex items-center gap-3">
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileSelect} />
              <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}
                className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isProcessing ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md"
                )}>
                {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : <><Upload className="h-4 w-4" /> Enviar outro</>}
              </button>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Paperclip className="h-3 w-3" /> Arraste ou clique &middot; JPG, PNG, WebP, PDF
              </span>
            </div>
          )}

          {/* Hidden file input for empty state */}
          {messages.length === 0 && (
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileSelect} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Compact Card ──────────────────────────────────

function CompactCard({ data }: { data: AIExtractionResult }) {
  const typeColor = getDocTypeColor(data.tipo_documento);
  return (
    <div className="flex items-center gap-2 text-xs flex-wrap">
      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", typeColor.bg, typeColor.text)}>
        {getDocTypeLabel(data.tipo_documento)}
      </span>
      <span className="font-medium text-gray-700">{formatCurrency(data.valor)}</span>
      <ArrowRight className="h-3 w-3 text-gray-300" />
      <span className="text-gray-500">{getDestinoLabel(data.destino)}</span>
    </div>
  );
}

// ─── Extraction Card (read-only) ───────────────────

function ExtractionCard({ data }: { data: AIExtractionResult }) {
  const typeColor = getDocTypeColor(data.tipo_documento);
  const DestinoIcon = DESTINO_ICONS[data.destino] || FileText;
  const confidenceColor = data.confianca >= 85 ? "text-green-600 bg-green-50" : data.confianca >= 60 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className={cn("px-2 py-0.5 rounded-md text-xs font-bold", typeColor.bg, typeColor.text)}>
          {getDocTypeLabel(data.tipo_documento)}
        </span>
        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", confidenceColor)}>
          {data.confianca}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <p className="text-gray-400 text-[10px]">Valor</p>
          <p className="font-bold text-gray-900 text-sm">{formatCurrency(data.valor)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-[10px]">Data</p>
          <p className="font-medium text-gray-700">{data.data_documento}</p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400 text-[10px]">Descrição</p>
          <p className="font-medium text-gray-700">{data.descricao}</p>
        </div>
        {data.emissor_nome && (
          <div className="col-span-2">
            <p className="text-gray-400 text-[10px]">Emissor</p>
            <p className="text-gray-700">{data.emissor_nome} {data.emissor_cnpj_cpf && <span className="text-gray-400">({data.emissor_cnpj_cpf})</span>}</p>
          </div>
        )}
        <div>
          <p className="text-gray-400 text-[10px]">Categoria</p>
          <p className="text-gray-700">{data.categoria_sugerida}</p>
          {data.subcategoria_sugerida && <p className="text-[10px] text-gray-400">{data.subcategoria_sugerida}</p>}
        </div>
        <div>
          <p className="text-gray-400 text-[10px]">Depto</p>
          <p className="text-gray-700">{data.departamento}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
        <DestinoIcon className="h-4 w-4 text-blue-600" />
        <div className="flex-1">
          <p className="text-[10px] text-blue-400">Destino</p>
          <p className="text-xs font-medium text-blue-700">{getDestinoLabel(data.destino)}</p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-blue-300" />
      </div>

      {(data.numero_nf || data.contrato_referencia || data.corretor_vinculado) && (
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {data.numero_nf && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">NF: {data.numero_nf}</span>}
          {data.contrato_referencia && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Contrato: {data.contrato_referencia}</span>}
          {data.corretor_vinculado && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Corretor: {data.corretor_vinculado}</span>}
        </div>
      )}

      {data.observacoes && <p className="text-[10px] text-gray-400 italic">{data.observacoes}</p>}
    </div>
  );
}

// ─── Editable Extraction ───────────────────────────

function EditableExtraction({
  data,
  onSave,
  onCancel,
  onConfirm,
}: {
  data: AIExtractionResult;
  onSave: (updated: AIExtractionResult) => void;
  onCancel: () => void;
  onConfirm: (updated: AIExtractionResult) => void;
}) {
  const [form, setForm] = useState<AIExtractionResult>({ ...data });

  const isReceita = form.tipo_documento === "RECEITA" || form.tipo_documento === "COMISSAO" || form.tipo_documento === "COMPROVANTE_PIX";
  const categorias = isReceita ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
  const subcats = SUBCATEGORIAS[form.categoria_sugerida] || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-amber-600">
        <Edit3 className="h-3.5 w-3.5" />
        Modo de edição — corrija os dados abaixo
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Tipo</label>
          <select value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value as DocumentType })}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500">
            {DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Departamento</label>
          <select value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value as "LOCACAO" | "VENDA" | "AMBOS" })}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500">
            <option value="LOCACAO">Locação</option>
            <option value="VENDA">Venda</option>
            <option value="AMBOS">Ambos</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Valor (R$)</label>
          <input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Data</label>
          <input type="text" value={form.data_documento} onChange={(e) => setForm({ ...form, data_documento: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-gray-400 mb-0.5">Descrição</label>
        <input type="text" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Emissor</label>
          <input type="text" value={form.emissor_nome} onChange={(e) => setForm({ ...form, emissor_nome: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">CPF/CNPJ</label>
          <input type="text" value={form.emissor_cnpj_cpf} onChange={(e) => setForm({ ...form, emissor_cnpj_cpf: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Categoria</label>
          <select value={form.categoria_sugerida} onChange={(e) => setForm({ ...form, categoria_sugerida: e.target.value, subcategoria_sugerida: "" })}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500">
            <option value="">Selecione...</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Subcategoria</label>
          <select value={form.subcategoria_sugerida} onChange={(e) => setForm({ ...form, subcategoria_sugerida: e.target.value })}
            disabled={subcats.length === 0}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50">
            <option value="">Selecione...</option>
            {subcats.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-gray-400 mb-0.5">Destino no sistema</label>
        <select value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value as AIExtractionResult["destino"] })}
          className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500">
          {DESTINOS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <button onClick={() => onConfirm(form)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
          <CheckCircle2 className="h-3.5 w-3.5" /> Salvar e Lançar
        </button>
        <button onClick={() => onSave(form)}
          className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">
          Salvar alterações
        </button>
        <button onClick={onCancel}
          className="px-3 py-1.5 text-gray-400 rounded-lg text-xs hover:text-gray-600 transition-colors ml-auto">
          Cancelar
        </button>
      </div>
    </div>
  );
}
