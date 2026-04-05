import { NextResponse } from "next/server";
import {
  processDocumentWithAI,
  processDocumentMock,
  fileToBase64,
  type AIExtractionResult,
} from "@/lib/utils/ai-processor";

/**
 * API DE OCR & CLASSIFICAÇÃO INTELIGENTE
 *
 * Pipeline: Upload → base64 → GPT-4o Vision → Dados Estruturados → Classificação
 *
 * - Com OPENAI_API_KEY: usa GPT-4o Vision para ler o documento real
 * - Sem OPENAI_API_KEY: usa mock inteligente baseado no nome do arquivo
 */

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado" },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Tipo de arquivo não suportado: ${file.type}. Use JPG, PNG, WebP ou PDF.`,
        },
        { status: 400 }
      );
    }

    // Validar tamanho (máx 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo 20MB." },
        { status: 400 }
      );
    }

    const hasApiKey = !!process.env.OPENAI_API_KEY;
    let data: AIExtractionResult;

    if (hasApiKey) {
      // PRODUÇÃO: GPT-4o Vision
      const base64 = await fileToBase64(file);
      const result = await processDocumentWithAI(base64, file.type);

      if (!result.success || !result.data) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Falha no processamento IA",
            mode: "ai",
          },
          { status: 422 }
        );
      }

      data = result.data;
    } else {
      // MOCK: simula resposta baseada no nome do arquivo
      const result = processDocumentMock(file.name);

      if (!result.success || !result.data) {
        return NextResponse.json(
          { success: false, error: "Falha no mock", mode: "mock" },
          { status: 500 }
        );
      }

      data = result.data;
    }

    return NextResponse.json({
      success: true,
      mode: hasApiKey ? "ai" : "mock",
      data,
    });
  } catch (error) {
    console.error("[OCR] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro interno de processamento",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
