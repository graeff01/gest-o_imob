"use client";

import { useState, useRef } from "react";
import {
  UploadCloud,
  Search,
  FileText,
  CheckCircle,
  X,
  Eye,
  ImageIcon,
  History,
  Download,
  ScanLine,
  Shield,
  Cpu,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Receipt,
  Landmark,
  Percent,
  FileQuestion,
  Zap,
  CreditCard,
  FileSignature,
  BadgeCheck,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { AIExtractionResult, DocumentType } from "@/lib/utils/ai-processor";

// ═══════════════════════════════════════════
// TIPOS LOCAIS
// ═══════════════════════════════════════════

interface ProcessedDocument {
  id: string;
  extraction: AIExtractionResult;
  previewUrl: string;
  fileName: string;
  processedAt: string;
  mode: "ai" | "mock";
  inserted: boolean;
  insertedTable?: string;
}

// ═══════════════════════════════════════════
// MAPAS DE VISUAL
// ═══════════════════════════════════════════

const DOC_TYPE_CONFIG: Record<
  DocumentType,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  DESPESA: { label: "Despesa", color: "text-red-700", bg: "bg-red-50", icon: TrendingDown },
  RECEITA: { label: "Receita", color: "text-green-700", bg: "bg-green-50", icon: TrendingUp },
  NOTA_FISCAL: { label: "Nota Fiscal", color: "text-blue-700", bg: "bg-blue-50", icon: Receipt },
  EXTRATO_BANCARIO: { label: "Extrato", color: "text-gray-700", bg: "bg-gray-100", icon: Landmark },
  COMISSAO: { label: "Comissão", color: "text-purple-700", bg: "bg-purple-50", icon: Percent },
  IMPOSTO: { label: "Imposto", color: "text-amber-700", bg: "bg-amber-50", icon: FileText },
  COMPROVANTE_PIX: { label: "PIX", color: "text-emerald-700", bg: "bg-emerald-50", icon: CreditCard },
  CONTRATO: { label: "Contrato", color: "text-indigo-700", bg: "bg-indigo-50", icon: FileSignature },
  OUTROS: { label: "Outros", color: "text-gray-600", bg: "bg-gray-50", icon: FileQuestion },
};

const DESTINO_CONFIG: Record<string, { label: string; color: string }> = {
  expenses: { label: "Despesas (Financeiro)", color: "text-red-600" },
  revenues: { label: "Receitas (Financeiro)", color: "text-green-600" },
  invoices: { label: "Notas Fiscais", color: "text-blue-600" },
  bank_transactions: { label: "Extratos Bancários", color: "text-gray-600" },
  manual: { label: "Classificação Manual", color: "text-orange-600" },
};

const SCAN_STEPS = [
  "Detectando bordas do documento...",
  "Aplicando correção de perspectiva...",
  "Executando OCR sobre o texto...",
  "Extraindo campos numéricos...",
  "Identificando CNPJ e razão social...",
  "Classificando tipo de documento...",
  "Validando dados extraídos...",
];

function getConfidenceColor(conf: number) {
  if (conf >= 85) return { text: "text-green-700", bg: "bg-green-50", bar: "bg-green-500" };
  if (conf >= 60) return { text: "text-amber-700", bg: "bg-amber-50", bar: "bg-amber-500" };
  return { text: "text-red-700", bg: "bg-red-50", bar: "bg-red-500" };
}

// ═══════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════

export default function DocumentosPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanMessage, setScanMessage] = useState("");
  const [extractedData, setExtractedData] = useState<AIExtractionResult | null>(null);
  const [aiMode, setAiMode] = useState<"ai" | "mock">("mock");
  const [showScanner, setShowScanner] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<ProcessedDocument[]>([]);
  const [viewingDoc, setViewingDoc] = useState<ProcessedDocument | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [isInserting, setIsInserting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setScanStep(0);
    setScanMessage("");
    setExtractedData(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  // ── ETAPA 1: Escanear com IA ──
  const startAIProcessing = async () => {
    if (!selectedFile || !previewUrl) return;
    setIsScanning(true);
    setScanStep(1);

    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      if (stepIndex < SCAN_STEPS.length) {
        setScanMessage(SCAN_STEPS[stepIndex]);
        stepIndex++;
      }
    }, 800);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch("/api/ocr", { method: "POST", body: formData });
      const result = await response.json();
      clearInterval(stepInterval);

      if (result.success && result.data) {
        setScanMessage("Análise concluída!");
        setAiMode(result.mode || "mock");
        setTimeout(() => {
          setExtractedData(result.data);
          setScanStep(2);
          setIsScanning(false);
        }, 600);
      } else {
        alert(result.error || "Erro no processamento");
        setIsScanning(false);
        setScanStep(0);
        setScanMessage("");
      }
    } catch {
      clearInterval(stepInterval);
      alert("Erro de conexão com o servidor.");
      setScanStep(0);
      setScanMessage("");
      setIsScanning(false);
    }
  };

  // ── ETAPA 2: Confirmar e lançar no sistema ──
  const confirmAndInsert = async () => {
    if (!extractedData || !selectedFile) return;
    setIsInserting(true);

    try {
      const response = await fetch("/api/process-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraction: extractedData,
          file_name: selectedFile.name,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const doc: ProcessedDocument = {
          id: result.record?.id || crypto.randomUUID(),
          extraction: extractedData,
          previewUrl: previewUrl || "",
          fileName: selectedFile.name,
          processedAt: new Date().toISOString(),
          mode: aiMode,
          inserted: true,
          insertedTable: result.table,
        };
        setHistory([doc, ...history]);
        resetScanner();
        setShowScanner(false);
      } else {
        alert(result.error || "Erro ao inserir no sistema");
      }
    } catch {
      alert("Erro de conexão ao confirmar lançamento.");
    } finally {
      setIsInserting(false);
    }
  };

  const resetScanner = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setScanStep(0);
    setScanMessage("");
    setExtractedData(null);
  };

  const filteredHistory = history.filter(
    (doc) =>
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.extraction.emissor_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.extraction.emissor_cnpj_cpf.includes(searchTerm)
  );

  // ── Contadores para summary cards ──
  const totalDocs = history.length;
  const totalDespesas = history.filter((h) => h.extraction.destino === "expenses").length;
  const totalReceitas = history.filter((h) => h.extraction.destino === "revenues").length;
  const totalNFs = history.filter((h) => h.extraction.destino === "invoices").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Triagem de Documentos</h1>
          <p className="text-sm text-gray-500">
            Escaneie documentos com IA — classifique e lance automaticamente no sistema.
          </p>
        </div>
        <button
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <ScanLine className="h-4 w-4" />
          Escanear Documento
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Documentos triados", value: totalDocs, icon: History, color: "text-gray-900" },
          { label: "Despesas lançadas", value: totalDespesas, icon: TrendingDown, color: "text-red-600" },
          { label: "Receitas lançadas", value: totalReceitas, icon: TrendingUp, color: "text-green-600" },
          { label: "NFs registradas", value: totalNFs, icon: Receipt, color: "text-blue-600" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2 text-gray-400">
              <stat.icon className="h-4 w-4" />
              <span className="text-xs text-gray-500">{stat.label}</span>
            </div>
            <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-400" />
            Registro de Documentos
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
        </div>

        {history.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Nenhum documento processado ainda.</p>
            <p className="text-xs text-gray-400 mt-1">
              Clique em &quot;Escanear Documento&quot; para começar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Documento</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Destino</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Confiança</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredHistory.map((doc) => {
                  const typeConf = DOC_TYPE_CONFIG[doc.extraction.tipo_documento] || DOC_TYPE_CONFIG.OUTROS;
                  const confColor = getConfidenceColor(doc.extraction.confianca);
                  const destConf = DESTINO_CONFIG[doc.extraction.destino] || DESTINO_CONFIG.manual;
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setViewingDoc(doc)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0">
                            <img src={doc.previewUrl} className="w-full h-full object-cover" alt="" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 truncate max-w-[160px]">
                              {doc.fileName}
                            </p>
                            <p className="text-xs text-gray-400">{doc.extraction.emissor_nome}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1",
                            typeConf.bg,
                            typeConf.color
                          )}
                        >
                          <typeConf.icon className="h-3 w-3" />
                          {typeConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-700 font-medium">
                          {doc.extraction.categoria_sugerida}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {doc.extraction.subcategoria_sugerida}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(doc.extraction.valor)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-medium", destConf.color)}>
                          {destConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", confColor.bar)}
                              style={{ width: `${doc.extraction.confianca}%` }}
                            />
                          </div>
                          <span className={cn("text-xs font-medium", confColor.text)}>
                            {doc.extraction.confianca}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {doc.inserted && (
                            <span className="p-1 text-green-500" title="Lançado no sistema">
                              <BadgeCheck className="h-4 w-4" />
                            </span>
                          )}
                          <button className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:text-blue-600 hover:border-blue-200 transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* SCANNER MODAL                              */}
      {/* ═══════════════════════════════════════════ */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl w-full max-w-5xl overflow-hidden flex shadow-2xl"
            style={{ height: "680px" }}
          >
            {/* Left - Document Preview + Scanner Animation */}
            <div className="w-3/5 bg-gray-950 flex items-center justify-center relative overflow-hidden">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,.pdf"
                onChange={handleFileChange}
              />

              {/* Grid overlay */}
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />

              {!selectedFile ? (
                <div
                  className={cn(
                    "w-[85%] h-[85%] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300",
                    dragActive
                      ? "border-blue-400 bg-blue-500/10"
                      : "border-gray-700 hover:border-gray-500 hover:bg-white/5"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                >
                  <div className="p-5 bg-gray-800 rounded-2xl mb-5">
                    <UploadCloud
                      className={cn(
                        "h-10 w-10 transition-colors",
                        dragActive ? "text-blue-400" : "text-gray-500"
                      )}
                    />
                  </div>
                  <p className="text-lg font-semibold text-gray-300">
                    Solte o documento aqui
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    JPG, PNG ou PDF - Nota fiscal, recibo, comprovante
                  </p>
                  <div className="flex gap-2 mt-6">
                    {["NF-e", "Recibo", "Boleto", "Extrato", "PIX"].map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-gray-800 text-gray-500 rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="relative w-[85%] h-[85%] flex items-center justify-center">
                  <div className="relative rounded-lg overflow-hidden shadow-2xl border border-gray-800">
                    <img
                      src={previewUrl || ""}
                      className={cn(
                        "max-w-full max-h-[580px] object-contain transition-all duration-500",
                        isScanning && "brightness-110"
                      )}
                      alt="Documento"
                    />

                    {/* Scanner Laser Animation */}
                    {isScanning && (
                      <>
                        <div
                          className="absolute left-0 right-0 h-[2px] z-20"
                          style={{
                            background:
                              "linear-gradient(90deg, transparent, #3b82f6 20%, #60a5fa 50%, #3b82f6 80%, transparent)",
                            boxShadow:
                              "0 0 15px 3px rgba(59,130,246,0.6), 0 0 40px 8px rgba(59,130,246,0.3)",
                            animation: "scanLine 2.5s ease-in-out infinite",
                          }}
                        />
                        <div
                          className="absolute left-0 right-0 h-16 z-10 pointer-events-none"
                          style={{
                            background:
                              "linear-gradient(180deg, rgba(59,130,246,0.12) 0%, transparent 100%)",
                            animation: "scanLine 2.5s ease-in-out infinite",
                          }}
                        />
                        <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl-sm z-20 animate-pulse" />
                        <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr-sm z-20 animate-pulse" />
                        <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl-sm z-20 animate-pulse" />
                        <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br-sm z-20 animate-pulse" />
                        <div className="absolute inset-0 bg-blue-500/5 z-10 pointer-events-none" />
                      </>
                    )}

                    {/* Scan complete checkmark */}
                    {scanStep === 2 && !isScanning && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
                        <div className="p-4 bg-green-500 rounded-full shadow-lg shadow-green-500/30 animate-[scaleIn_0.3s_ease-out]">
                          <CheckCircle className="h-10 w-10 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {!isScanning && scanStep === 0 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-3 right-3 px-3 py-1.5 bg-gray-800/90 text-gray-300 rounded-lg text-xs hover:bg-gray-700 transition-colors"
                    >
                      Trocar arquivo
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right - Processing Panel */}
            <div className="w-2/5 p-6 flex flex-col bg-white overflow-y-auto">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      isScanning
                        ? "bg-blue-500 animate-pulse"
                        : scanStep === 2
                          ? "bg-green-500"
                          : "bg-gray-300"
                    )}
                  />
                  <h3 className="text-lg font-bold text-gray-900">
                    {isScanning
                      ? "Escaneando..."
                      : scanStep === 2
                        ? "Análise Concluída"
                        : "Scanner IA"}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowScanner(false);
                    resetScanner();
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Estado: Nenhum arquivo */}
              {!selectedFile ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="p-4 bg-gray-50 rounded-2xl mb-4">
                    <ImageIcon className="h-8 w-8 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">Aguardando documento...</p>
                  <p className="text-xs text-gray-300 mt-1">
                    Arraste um arquivo ou clique na área à esquerda
                  </p>
                </div>
              ) : scanStep === 0 ? (
                <div className="flex-1 flex flex-col justify-center">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-blue-600 font-medium">Arquivo carregado</p>
                        <p className="text-sm font-semibold text-blue-900 truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-blue-400">
                          {(selectedFile.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <p className="text-xs text-gray-500 font-medium mb-2">
                      O que a IA vai extrair:
                    </p>
                    <div className="space-y-1.5">
                      {[
                        "Tipo do documento e classificação",
                        "Valor, data e método de pagamento",
                        "CNPJ/CPF e razão social do emissor",
                        "Categoria e subcategoria financeira",
                        "Destino correto no sistema (despesa, receita, NF...)",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-xs text-gray-600">
                          <div className="w-1 h-1 bg-blue-500 rounded-full" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={startAIProcessing}
                    className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                  >
                    <ScanLine className="h-4 w-4" />
                    Iniciar Escaneamento
                  </button>
                </div>
              ) : scanStep === 1 ? (
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-center justify-center mb-8">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full border-[3px] border-gray-100" />
                      <div
                        className="absolute inset-0 w-20 h-20 rounded-full border-[3px] border-transparent border-t-blue-500"
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                      <Cpu className="absolute inset-0 m-auto h-7 w-7 text-blue-600" />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 mb-3">
                      Log de processamento
                    </p>
                    {SCAN_STEPS.map((step, i) => {
                      const currentIdx = SCAN_STEPS.indexOf(scanMessage);
                      const isDone = i < currentIdx;
                      const isCurrent = i === currentIdx;
                      const isPending = i > currentIdx;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center gap-2 text-xs transition-all duration-300",
                            isDone && "text-green-600",
                            isCurrent && "text-blue-600 font-medium",
                            isPending && "text-gray-300"
                          )}
                        >
                          {isDone ? (
                            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                          ) : isCurrent ? (
                            <div className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                            </div>
                          ) : (
                            <div className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                            </div>
                          )}
                          {step}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : extractedData ? (
                <div className="flex-1 flex flex-col">
                  {/* Mode badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
                        aiMode === "ai"
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-700"
                      )}
                    >
                      <Zap className="h-2.5 w-2.5 inline mr-0.5" />
                      {aiMode === "ai" ? "GPT-4o Vision" : "Modo Simulação"}
                    </span>
                  </div>

                  {/* Document Type Badge */}
                  {(() => {
                    const tc = DOC_TYPE_CONFIG[extractedData.tipo_documento] || DOC_TYPE_CONFIG.OUTROS;
                    return (
                      <div className={cn("p-3 rounded-xl border mb-3 flex items-center gap-3", tc.bg)}>
                        <tc.icon className={cn("h-5 w-5", tc.color)} />
                        <div>
                          <p className="text-[10px] text-gray-500">Tipo identificado</p>
                          <p className={cn("text-sm font-semibold", tc.color)}>{tc.label}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Confidence bar */}
                  {(() => {
                    const cc = getConfidenceColor(extractedData.confianca);
                    return (
                      <div className={cn("p-3 rounded-xl border mb-3", cc.bg)}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] text-gray-500">Confiança da IA</p>
                          <span className={cn("text-sm font-bold", cc.text)}>
                            {extractedData.confianca}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", cc.bar)}
                            style={{ width: `${extractedData.confianca}%` }}
                          />
                        </div>
                        {extractedData.confianca < 60 && (
                          <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Confiança baixa — revise os dados antes de confirmar
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Extracted Fields */}
                  <div className="space-y-2 mb-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                          Valor
                        </p>
                        <p className="text-base font-bold text-gray-900">
                          {formatCurrency(extractedData.valor)}
                        </p>
                      </div>
                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                          Data
                        </p>
                        <p className="text-base font-bold text-gray-900">
                          {extractedData.data_documento}
                        </p>
                      </div>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                        Emissor
                      </p>
                      <p className="text-sm font-medium text-gray-700">
                        {extractedData.emissor_nome}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {extractedData.emissor_cnpj_cpf}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                          Categoria
                        </p>
                        <p className="text-xs font-medium text-gray-700">
                          {extractedData.categoria_sugerida}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {extractedData.subcategoria_sugerida}
                        </p>
                      </div>
                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                          Departamento
                        </p>
                        <p className="text-xs font-medium text-gray-700">
                          {extractedData.departamento}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Destination */}
                  {(() => {
                    const dc = DESTINO_CONFIG[extractedData.destino] || DESTINO_CONFIG.manual;
                    return (
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                          <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">
                            Destino no sistema
                          </p>
                        </div>
                        <p className={cn("text-sm font-semibold", dc.color)}>{dc.label}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {extractedData.destino_descricao}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Observations */}
                  {extractedData.observacoes && (
                    <p className="text-[10px] text-gray-400 italic mb-3 px-1">
                      {extractedData.observacoes}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3 mt-auto">
                    <button
                      onClick={resetScanner}
                      className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={confirmAndInsert}
                      disabled={isInserting}
                      className="flex-[2] py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isInserting ? (
                        <>
                          <div
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                            style={{ animation: "spin 0.6s linear infinite" }}
                          />
                          Lançando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Confirmar e Lançar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* DOCUMENT DETAIL MODAL                      */}
      {/* ═══════════════════════════════════════════ */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex overflow-hidden shadow-2xl">
            <div className="w-[60%] bg-gray-950 p-6 flex items-center justify-center overflow-hidden border-r border-gray-200">
              <img
                src={viewingDoc.previewUrl}
                className="max-h-full max-w-full rounded-lg shadow-2xl"
                alt=""
              />
            </div>
            <div className="w-[40%] p-6 bg-white flex flex-col overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-900">Detalhes do Documento</h3>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Type + Confidence */}
              <div className="flex items-center gap-2 mb-4">
                {(() => {
                  const tc =
                    DOC_TYPE_CONFIG[viewingDoc.extraction.tipo_documento] || DOC_TYPE_CONFIG.OUTROS;
                  return (
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1",
                        tc.bg,
                        tc.color
                      )}
                    >
                      <tc.icon className="h-3 w-3" />
                      {tc.label}
                    </span>
                  );
                })()}
                {(() => {
                  const cc = getConfidenceColor(viewingDoc.extraction.confianca);
                  return (
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium",
                        cc.bg,
                        cc.text
                      )}
                    >
                      {viewingDoc.extraction.confianca}% confiança
                    </span>
                  );
                })()}
                {viewingDoc.inserted && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 inline-flex items-center gap-1">
                    <BadgeCheck className="h-3 w-3" />
                    Lançado
                  </span>
                )}
              </div>

              <div className="space-y-3 flex-1">
                {[
                  { l: "Valor", v: formatCurrency(viewingDoc.extraction.valor), bold: true },
                  { l: "Data", v: viewingDoc.extraction.data_documento },
                  { l: "Emissor", v: viewingDoc.extraction.emissor_nome },
                  { l: "CNPJ/CPF", v: viewingDoc.extraction.emissor_cnpj_cpf },
                  { l: "Descrição", v: viewingDoc.extraction.descricao },
                  {
                    l: "Categoria",
                    v: `${viewingDoc.extraction.categoria_sugerida} > ${viewingDoc.extraction.subcategoria_sugerida}`,
                  },
                  { l: "Departamento", v: viewingDoc.extraction.departamento },
                  {
                    l: "Destino",
                    v:
                      DESTINO_CONFIG[viewingDoc.extraction.destino]?.label ||
                      viewingDoc.extraction.destino,
                  },
                  {
                    l: "Método pagamento",
                    v: viewingDoc.extraction.metodo_pagamento || "—",
                  },
                  {
                    l: "Corretor vinculado",
                    v: viewingDoc.extraction.corretor_vinculado || "—",
                  },
                  { l: "Processado em", v: formatDate(viewingDoc.processedAt) },
                  {
                    l: "Modo",
                    v: viewingDoc.mode === "ai" ? "GPT-4o Vision" : "Simulação (mock)",
                  },
                ].map((it, i) => (
                  <div key={i} className="pb-2 border-b border-gray-100 last:border-0">
                    <p className="text-[10px] text-gray-500 mb-0.5">{it.l}</p>
                    <p
                      className={cn(
                        "text-sm font-medium text-gray-800",
                        it.bold && "text-lg font-bold text-blue-700"
                      )}
                    >
                      {it.v}
                    </p>
                  </div>
                ))}

                {viewingDoc.extraction.observacoes && (
                  <div className="pb-2">
                    <p className="text-[10px] text-gray-500 mb-0.5">Observações da IA</p>
                    <p className="text-xs text-gray-600 italic">
                      {viewingDoc.extraction.observacoes}
                    </p>
                  </div>
                )}
              </div>

              <button className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors mt-4">
                <Download className="h-4 w-4" />
                Baixar comprovante original
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanner CSS Animations */}
      <style jsx global>{`
        @keyframes scanLine {
          0% {
            top: 0%;
          }
          50% {
            top: calc(100% - 2px);
          }
          100% {
            top: 0%;
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
