import { NextResponse } from "next/server";
import type { AIExtractionResult } from "@/lib/utils/ai-processor";

/**
 * API DE AUTO-INSERÇÃO NO SISTEMA
 *
 * Recebe os dados confirmados pelo gestor (após OCR/IA) e insere
 * no modelo correto do banco de dados baseado no campo "destino".
 *
 * Fluxo: Documento → OCR/IA → Gestor confirma → Esta rota insere no banco
 *
 * Como o banco ainda não está conectado (Railway PostgreSQL pendente),
 * esta rota simula a inserção e retorna o que SERIA criado.
 * Ao conectar o banco, basta descomentar os blocos Prisma.
 */

interface ProcessDocumentRequest {
  extraction: AIExtractionResult;
  file_name: string;
  file_url?: string;
  confirmed_by?: string; // user ID
  overrides?: {
    // Campos que o gestor pode corrigir antes de confirmar
    valor?: number;
    categoria_sugerida?: string;
    subcategoria_sugerida?: string;
    departamento?: string;
    destino?: string;
    descricao?: string;
  };
}

function parseDateBR(dateStr: string): Date {
  // Aceita DD/MM/YYYY
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    return new Date(
      parseInt(parts[2]),
      parseInt(parts[1]) - 1,
      parseInt(parts[0])
    );
  }
  return new Date();
}

function getMonthYear(dateStr: string): { month: number; year: number } {
  const date = parseDateBR(dateStr);
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

export async function POST(req: Request) {
  try {
    const body: ProcessDocumentRequest = await req.json();
    const { extraction, file_name, overrides } = body;

    if (!extraction) {
      return NextResponse.json(
        { error: "Dados de extração não fornecidos" },
        { status: 400 }
      );
    }

    // Aplica correções do gestor sobre os dados da IA
    const data = {
      ...extraction,
      ...(overrides?.valor !== undefined && { valor: overrides.valor }),
      ...(overrides?.categoria_sugerida && {
        categoria_sugerida: overrides.categoria_sugerida,
      }),
      ...(overrides?.subcategoria_sugerida && {
        subcategoria_sugerida: overrides.subcategoria_sugerida,
      }),
      ...(overrides?.departamento && {
        departamento: overrides.departamento,
      }),
      ...(overrides?.destino && { destino: overrides.destino }),
      ...(overrides?.descricao && { descricao: overrides.descricao }),
    };

    const { month, year } = getMonthYear(data.data_documento);
    const destino = data.destino;

    // ═══════════════════════════════════════════
    // INSERÇÃO POR DESTINO
    // ═══════════════════════════════════════════

    let insertedRecord: Record<string, unknown> = {};
    let insertedTable = "";

    switch (destino) {
      case "expenses": {
        // Lançar como Despesa
        // TODO: Quando banco conectado, usar Prisma:
        // const category = await prisma.expenseCategory.findFirst({
        //   where: { name: { contains: data.subcategoria_sugerida } }
        // });
        // const expense = await prisma.expense.create({ ... });

        insertedRecord = {
          id: crypto.randomUUID(),
          description: data.descricao,
          amount: data.valor,
          date: parseDateBR(data.data_documento).toISOString(),
          department: data.departamento,
          payment_method: data.metodo_pagamento || null,
          status: "PENDENTE",
          reference_month: month,
          reference_year: year,
          supplier: data.emissor_nome,
          category_name: `${data.categoria_sugerida} > ${data.subcategoria_sugerida}`,
          source_document: file_name,
          ai_confidence: data.confianca,
        };
        insertedTable = "expenses";
        break;
      }

      case "revenues": {
        // Lançar como Receita
        // TODO: prisma.revenue.create({ ... })

        insertedRecord = {
          id: crypto.randomUUID(),
          description: data.descricao,
          amount: data.valor,
          date: parseDateBR(data.data_documento).toISOString(),
          department: data.departamento,
          category: "OUTRO",
          reference_month: month,
          reference_year: year,
          source_document: file_name,
          ai_confidence: data.confianca,
        };
        insertedTable = "revenues";
        break;
      }

      case "invoices": {
        // Registrar como Nota Fiscal
        // TODO: prisma.invoice.create({ ... })

        insertedRecord = {
          id: crypto.randomUUID(),
          client_name: data.emissor_nome,
          client_cpf_cnpj: data.emissor_cnpj_cpf,
          service_type: "INTERMEDIACAO",
          amount: data.valor,
          description_title: data.descricao,
          description_body: data.observacoes || data.descricao,
          status: "PENDENTE",
          reference_year: year,
          nfse_number: data.numero_nf || null,
          corretor_vinculado: data.corretor_vinculado || null,
          source_document: file_name,
          ai_confidence: data.confianca,
        };
        insertedTable = "invoices";
        break;
      }

      case "bank_transactions": {
        // Importar como transação bancária
        insertedRecord = {
          id: crypto.randomUUID(),
          description: data.descricao,
          amount: data.valor,
          date: parseDateBR(data.data_documento).toISOString(),
          is_credit: data.tipo_documento === "RECEITA",
          operation_type: data.metodo_pagamento || "OUTROS",
          is_reconciled: false,
          source_document: file_name,
          ai_confidence: data.confianca,
          note: "Recomendado usar o importador de extratos para processamento em lote.",
        };
        insertedTable = "bank_transactions";
        break;
      }

      case "manual":
      default: {
        // Classificação manual - salva como documento pendente de revisão
        insertedRecord = {
          id: crypto.randomUUID(),
          filename: file_name,
          document_type: data.tipo_documento,
          ai_extracted_data: data,
          ai_classification: data.categoria_sugerida,
          ai_confidence: data.confianca / 100,
          processing_status: "PROCESSADO",
          is_reviewed: false,
          note: "Classificação automática não definitiva. Requer revisão manual.",
        };
        insertedTable = "documents";
        break;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Documento processado e encaminhado para ${insertedTable}`,
      table: insertedTable,
      record: insertedRecord,
      ai_data: data,
      // Flag para o frontend saber que ainda é simulação
      simulated: true,
    });
  } catch (error) {
    console.error("[PROCESS-DOCUMENT] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro ao processar documento",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
