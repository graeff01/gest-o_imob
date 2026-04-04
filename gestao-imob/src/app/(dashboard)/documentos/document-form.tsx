"use client";

import { useState } from "react";
import { UploadCloud, File, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function DocumentForm({ onSuccess, onCancel }: DocumentFormProps) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("NOTA_FISCAL");
  const [dragActive, setDragActive] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      alert("Selecione um arquivo.");
      return;
    }
    
    setLoading(true);

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_filename: file.name,
          mime_type: file.type || "application/octet-stream",
          file_size: file.size,
          document_type: docType,
        }),
      });

      if (!res.ok) throw new Error("Erro ao salvar documento");

      onSuccess();
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar documento");
    } finally {
      setLoading(false);
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Novo Envio de Documento</h3>
        <p className="text-sm text-gray-500 mt-1">Carregue notas, planilhas ou recibos para processamento.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento *</label>
          <select 
            required 
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="NOTA_FISCAL">Nota Fiscal</option>
            <option value="RECIBO">Recibo</option>
            <option value="EXTRATO_BANCARIO">Extrato Bancário</option>
            <option value="PLANILHA">Planilha</option>
            <option value="COMPROVANTE">Comprovante</option>
            <option value="CONTRATO">Contrato</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo *</label>
          <div 
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
              dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                  <File className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setFile(null)}
                  className="mt-2 text-sm text-red-600 hover:underline flex items-center gap-1"
                >
                  <X className="h-4 w-4" /> Remover
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-gray-200 p-4 rounded-full text-gray-500">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Arraste e solte o arquivo aqui</p>
                  <p className="text-xs text-gray-500">ou clique para selecionar do computador</p>
                </div>
                <input 
                  type="file" 
                  id="file-upload" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0]);
                    }
                  }} 
                />
                <button 
                  type="button"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  className="mt-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Selecionar Arquivo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !file}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Enviando..." : (
            <>
              <Check className="h-4 w-4" /> Enviar
            </>
          )}
        </button>
      </div>
    </form>
  );
}
