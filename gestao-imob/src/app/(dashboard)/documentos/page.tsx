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
  ShoppingCart,
  Layers,
  LineChart,
  Wallet,
  History,
  Download,
  ScanLine,
  Shield,
  Cpu,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface ExtractedData {
  id: string;
  valor: number;
  emissor: string;
  cnpj: string;
  data: string;
  categoria: string;
  sugestao: string;
  corretorSugerido?: string;
  previewUrl: string;
  fileName: string;
  processedAt: string;
}

const CATEGORY_MAP: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  NF_CORRETOR: { label: "Comissão de Corretor", color: "text-blue-700", bg: "bg-blue-50", icon: Wallet },
  DESPESA_OPERACIONAL: { label: "Gasto Operacional", color: "text-orange-700", bg: "bg-orange-50", icon: ShoppingCart },
  MARKETING: { label: "Marketing / Ads", color: "text-purple-700", bg: "bg-purple-50", icon: LineChart },
  OUTROS: { label: "Outros Documentos", color: "text-gray-700", bg: "bg-gray-50", icon: Layers },
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

export default function DocumentosPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanMessage, setScanMessage] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<ExtractedData[]>([]);
  const [viewingDoc, setViewingDoc] = useState<ExtractedData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setScanStep(0);
    setScanMessage("");
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

  const startAIProcessing = async () => {
    if (!selectedFile || !previewUrl) return;
    setIsScanning(true);
    setScanStep(1);

    // Animate scan steps
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
      if (result.success) {
        setScanMessage("Análise concluída!");
        setTimeout(() => {
          setExtractedData({
            ...result.data,
            id: Math.random().toString(36).substr(2, 9),
            previewUrl: previewUrl,
            fileName: selectedFile.name,
            processedAt: new Date().toISOString(),
          });
          setScanStep(2);
          setIsScanning(false);
        }, 600);
      } else {
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

  const confirmLaunch = () => {
    if (extractedData) {
      setHistory([extractedData, ...history]);
      resetScanner();
      setShowScanner(false);
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
      doc.emissor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.cnpj.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Triagem de Documentos</h1>
          <p className="text-sm text-gray-500">Escaneie, classifique e armazene comprovantes com IA.</p>
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
          { label: "Total triado", value: history.length, icon: History, color: "text-gray-900" },
          { label: "NF Corretores", value: history.filter((h) => h.categoria === "NF_CORRETOR").length, icon: Wallet, color: "text-blue-600" },
          { label: "Despesas Oper.", value: history.filter((h) => h.categoria === "DESPESA_OPERACIONAL").length, icon: ShoppingCart, color: "text-orange-600" },
          { label: "Marketing", value: history.filter((h) => h.categoria === "MARKETING").length, icon: LineChart, color: "text-purple-600" },
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
            <p className="text-xs text-gray-400 mt-1">Clique em &quot;Escanear Documento&quot; para começar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Documento</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Emissor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredHistory.map((doc) => {
                  const cat = CATEGORY_MAP[doc.categoria];
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setViewingDoc(doc)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0">
                            <img src={doc.previewUrl} className="w-full h-full object-cover" alt="" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 truncate max-w-[180px]">{doc.fileName}</p>
                            <p className="text-xs text-gray-400 font-mono">{doc.cnpj}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1", cat.bg, cat.color)}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(doc.valor)}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs truncate max-w-[150px]">{doc.emissor}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(doc.processedAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <button className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:text-blue-600 hover:border-blue-200 transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SCANNER MODAL                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl overflow-hidden flex shadow-2xl" style={{ height: "680px" }}>

            {/* Left - Document Preview + Scanner Animation */}
            <div className="w-3/5 bg-gray-950 flex items-center justify-center relative overflow-hidden">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />

              {/* Grid overlay */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }} />

              {!selectedFile ? (
                <div
                  className={cn(
                    "w-[85%] h-[85%] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300",
                    dragActive
                      ? "border-blue-400 bg-blue-500/10"
                      : "border-gray-700 hover:border-gray-500 hover:bg-white/5"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                >
                  <div className="p-5 bg-gray-800 rounded-2xl mb-5">
                    <UploadCloud className={cn("h-10 w-10 transition-colors", dragActive ? "text-blue-400" : "text-gray-500")} />
                  </div>
                  <p className="text-lg font-semibold text-gray-300">Solte o documento aqui</p>
                  <p className="text-sm text-gray-600 mt-2">JPG, PNG ou PDF - Nota fiscal, recibo, comprovante</p>
                  <div className="flex gap-2 mt-6">
                    {["NF-e", "Recibo", "Boleto", "Extrato"].map((tag) => (
                      <span key={tag} className="px-3 py-1 bg-gray-800 text-gray-500 rounded-full text-xs">{tag}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="relative w-[85%] h-[85%] flex items-center justify-center">
                  {/* Document image */}
                  <div className="relative rounded-lg overflow-hidden shadow-2xl border border-gray-800">
                    <img
                      src={previewUrl || ""}
                      className={cn(
                        "max-w-full max-h-[580px] object-contain transition-all duration-500",
                        isScanning && "brightness-110"
                      )}
                      alt="Documento"
                    />

                    {/* ====== SCANNER LASER ANIMATION ====== */}
                    {isScanning && (
                      <>
                        {/* Laser line */}
                        <div
                          className="absolute left-0 right-0 h-[2px] z-20"
                          style={{
                            background: "linear-gradient(90deg, transparent, #3b82f6 20%, #60a5fa 50%, #3b82f6 80%, transparent)",
                            boxShadow: "0 0 15px 3px rgba(59,130,246,0.6), 0 0 40px 8px rgba(59,130,246,0.3)",
                            animation: "scanLine 2.5s ease-in-out infinite",
                          }}
                        />
                        {/* Laser glow trail */}
                        <div
                          className="absolute left-0 right-0 h-16 z-10 pointer-events-none"
                          style={{
                            background: "linear-gradient(180deg, rgba(59,130,246,0.12) 0%, transparent 100%)",
                            animation: "scanLine 2.5s ease-in-out infinite",
                          }}
                        />
                        {/* Corner brackets */}
                        <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl-sm z-20 animate-pulse" />
                        <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr-sm z-20 animate-pulse" />
                        <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl-sm z-20 animate-pulse" />
                        <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br-sm z-20 animate-pulse" />
                        {/* Tint overlay */}
                        <div className="absolute inset-0 bg-blue-500/5 z-10 pointer-events-none" />
                      </>
                    )}

                    {/* Scan complete checkmark */}
                    {scanStep === 2 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
                        <div className="p-4 bg-green-500 rounded-full shadow-lg shadow-green-500/30 animate-[scaleIn_0.3s_ease-out]">
                          <CheckCircle className="h-10 w-10 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Replace file button */}
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
            <div className="w-2/5 p-8 flex flex-col bg-white">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    isScanning ? "bg-blue-500 animate-pulse" : scanStep === 2 ? "bg-green-500" : "bg-gray-300"
                  )} />
                  <h3 className="text-lg font-bold text-gray-900">
                    {isScanning ? "Escaneando..." : scanStep === 2 ? "Análise Concluída" : "Scanner IA"}
                  </h3>
                </div>
                <button
                  onClick={() => { setShowScanner(false); resetScanner(); }}
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
                  <p className="text-xs text-gray-300 mt-1">Arraste um arquivo ou clique na área à esquerda</p>
                </div>
              ) : scanStep === 0 ? (
                <div className="flex-1 flex flex-col justify-center">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-blue-600 font-medium">Arquivo carregado</p>
                        <p className="text-sm font-semibold text-blue-900 truncate">{selectedFile.name}</p>
                        <p className="text-xs text-blue-400">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <p className="text-xs text-gray-500 font-medium mb-2">O que a IA vai extrair:</p>
                    <div className="space-y-1.5">
                      {["Valor e data do documento", "CNPJ e razão social", "Tipo e categoria", "Dados do beneficiário"].map((item) => (
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
                  {/* Processing indicator */}
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

                  {/* Step log */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 mb-3">Log de processamento</p>
                    {SCAN_STEPS.map((step, i) => {
                      const currentIdx = SCAN_STEPS.indexOf(scanMessage);
                      const isDone = i < currentIdx;
                      const isCurrent = i === currentIdx;
                      const isPending = i > currentIdx;
                      return (
                        <div key={i} className={cn(
                          "flex items-center gap-2 text-xs transition-all duration-300",
                          isDone && "text-green-600",
                          isCurrent && "text-blue-600 font-medium",
                          isPending && "text-gray-300",
                        )}>
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

              ) : (
                <div className="flex-1 flex flex-col">
                  {/* Category Result */}
                  <div className={cn("p-4 rounded-xl border mb-5 flex items-start gap-3", CATEGORY_MAP[extractedData!.categoria].bg)}>
                    {(() => { const Icon = CATEGORY_MAP[extractedData!.categoria].icon; return <Icon className={cn("h-6 w-6 mt-0.5", CATEGORY_MAP[extractedData!.categoria].color)} />; })()}
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Classificação automática</p>
                      <p className={cn("text-base font-semibold", CATEGORY_MAP[extractedData!.categoria].color)}>
                        {CATEGORY_MAP[extractedData!.categoria].label}
                      </p>
                    </div>
                  </div>

                  {/* Extracted Fields */}
                  <div className="space-y-3 mb-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Valor</p>
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(extractedData!.valor)}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Data</p>
                        <p className="text-lg font-bold text-gray-900">{extractedData!.data}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Beneficiário</p>
                      <p className="text-sm font-medium text-gray-700">{extractedData!.emissor}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">CNPJ</p>
                      <p className="text-sm font-medium text-gray-700 font-mono">{extractedData!.cnpj}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-auto">
                    <button
                      onClick={resetScanner}
                      className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={confirmLaunch}
                      className="flex-[2] py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Confirmar Lançamento
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Detail Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex overflow-hidden shadow-2xl">
            <div className="w-[60%] bg-gray-950 p-6 flex items-center justify-center overflow-hidden border-r border-gray-200">
              <img src={viewingDoc.previewUrl} className="max-h-full max-w-full rounded-lg shadow-2xl" alt="" />
            </div>
            <div className="w-[40%] p-8 bg-white flex flex-col">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-bold text-gray-900">Detalhes do Documento</h3>
                <button onClick={() => setViewingDoc(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 flex-1">
                {[
                  { l: "Código interno", v: viewingDoc.id },
                  { l: "Classificação", v: CATEGORY_MAP[viewingDoc.categoria].label },
                  { l: "Valor confirmado", v: formatCurrency(viewingDoc.valor), bold: true },
                  { l: "Emissor", v: viewingDoc.emissor },
                  { l: "CNPJ", v: viewingDoc.cnpj },
                  { l: "Data do documento", v: viewingDoc.data },
                  { l: "Processado em", v: formatDate(viewingDoc.processedAt) },
                ].map((it, i) => (
                  <div key={i} className="pb-3 border-b border-gray-100 last:border-0">
                    <p className="text-xs text-gray-500 mb-0.5">{it.l}</p>
                    <p className={cn("text-sm font-medium text-gray-800", it.bold && "text-lg font-bold text-blue-700")}>{it.v}</p>
                  </div>
                ))}
              </div>

              <button className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
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
          0% { top: 0%; }
          50% { top: calc(100% - 2px); }
          100% { top: 0%; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes scaleIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
