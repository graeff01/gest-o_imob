/**
 * POST /api/invoices/import-dw
 * ----------------------------
 * Recebe o arquivo Excel exportado do DW, faz o parse, checa duplicatas
 * e retorna um preview das linhas para o usuário confirmar antes de salvar.
 *
 * Fluxo:
 *   1. Upload do arquivo (multipart/form-data)
 *   2. Parse das linhas com dw-parser
 *   3. Checagem de duplicatas (title_number + reference_year já no banco)
 *   4. Retorna preview com status de cada linha (nova / duplicata / erro)
 *
 * POST /api/invoices/import-dw?confirm=true
 *   - Mesmo fluxo, mas persiste as linhas NOVAS no banco.
 *   - Duplicatas são ignoradas silenciosamente (idempotente).
 *
 * Segurança:
 *   - Só ADMIN_MASTER e DONO podem importar (verificado via sessão)
 *   - Arquivo limitado a 10MB
 *   - Apenas .xlsx e .xls aceitos
 *   - Cada linha salva com created_by = userId da sessão
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDWExcel, DWParsedRow } from "@/lib/utils/dw-parser";

// Perfis autorizados a importar notas
const AUTHORIZED_ROLES = ["ADMIN_MASTER", "DONO"];

// Tamanho máximo do arquivo: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ─── Tipos de resposta ────────────────────────────────────────────────────────

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
  /** "nova" = será inserida | "duplicata" = já existe no banco (será ignorada) */
  import_status: "nova" | "duplicata";
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── 1. Autenticação e autorização ──
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 }
    );
  }

  if (!AUTHORIZED_ROLES.includes(session.user.role as string)) {
    return NextResponse.json(
      { error: "Sem permissão. Apenas ADMIN_MASTER e DONO podem importar notas do DW." },
      { status: 403 }
    );
  }

  const userId = session.user.id;

  // ── 2. Leitura do arquivo ──
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida. Envie o arquivo como multipart/form-data." },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json(
      { error: "Nenhum arquivo enviado. Use o campo 'file' no formulário." },
      { status: 400 }
    );
  }

  // Validação do tipo de arquivo
  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel",                                           // .xls
  ];
  const fileName = file.name.toLowerCase();
  if (!allowedTypes.includes(file.type) && !fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
    return NextResponse.json(
      { error: "Formato inválido. Envie um arquivo .xlsx ou .xls exportado do DW." },
      { status: 400 }
    );
  }

  // Validação do tamanho
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: 10MB.` },
      { status: 400 }
    );
  }

  // Converte para Buffer para o parser
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ── 3. Parse do Excel ──
  const parseResult = parseDWExcel(buffer);

  if (parseResult.rows.length === 0 && parseResult.errors.length > 0) {
    // Nenhuma linha válida — retorna os erros para o usuário corrigir o arquivo
    return NextResponse.json(
      {
        error: "Nenhuma linha válida encontrada no arquivo.",
        parseErrors: parseResult.errors,
        totalRows: parseResult.totalRows,
      },
      { status: 422 }
    );
  }

  // ── 4. Checagem de duplicatas ──
  // Busca no banco todos os title_numbers das linhas parseadas
  const titleNumbers = parseResult.rows.map((r) => r.title_number);

  const existingInvoices = await prisma.invoice.findMany({
    where: {
      title_number: { in: titleNumbers },
    },
    select: {
      title_number: true,
      reference_year: true,
    },
  });

  // Set de chaves "title_number|reference_year" para lookup O(1)
  const existingKeys = new Set(
    existingInvoices.map((inv) => `${inv.title_number}|${inv.reference_year}`)
  );

  // Classifica cada linha como nova ou duplicata
  const previewRows: PreviewRow[] = parseResult.rows.map((row) => {
    const key = `${row.title_number}|${row.reference_year}`;
    const isDuplicate = existingKeys.has(key);

    return {
      rowIndex: row.rowIndex,
      title_number: row.title_number,
      client_name: row.client_name,
      client_cpf_cnpj: row.client_cpf_cnpj,
      property_address: row.property_address,
      service_type: row.service_type,
      amount: row.amount,
      due_date: row.due_date.toISOString().split("T")[0],
      reference_month: row.reference_month,
      reference_year: row.reference_year,
      description_title: row.description_title,
      description_body: row.description_body,
      agency_name: row.agency_name,
      dw_status: row.dw_status,
      import_status: isDuplicate ? "duplicata" : "nova",
    };
  });

  const newRows = parseResult.rows.filter((row) => {
    const key = `${row.title_number}|${row.reference_year}`;
    return !existingKeys.has(key);
  });

  // ── 5. Modo preview vs confirmação ──
  const confirm = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirm) {
    // Retorna apenas o preview — usuário ainda não confirmou
    return NextResponse.json({
      preview: previewRows,
      summary: {
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        newRows: newRows.length,
        duplicateRows: previewRows.filter((r) => r.import_status === "duplicata").length,
        errorRows: parseResult.errors.length,
        skippedRows: parseResult.skippedRows,
      },
      parseErrors: parseResult.errors,
    });
  }

  // ── 6. Confirmado — persiste as linhas NOVAS no banco ──
  if (newRows.length === 0) {
    return NextResponse.json({
      message: "Nenhuma nota nova para importar. Todas as linhas já existem no sistema.",
      imported: 0,
      duplicates: previewRows.filter((r) => r.import_status === "duplicata").length,
    });
  }

  // Calcula a sequência de ano atual para as novas notas
  const currentYear = new Date().getFullYear();
  const lastInvoice = await prisma.invoice.findFirst({
    where: { reference_year: currentYear },
    orderBy: { year_sequence: "desc" },
    select: { year_sequence: true },
  });
  let nextSequence = (lastInvoice?.year_sequence ?? 0) + 1;

  // Insere em lote com tratamento de conflito individual
  // (createMany com skipDuplicates garante idempotência mesmo em race conditions)
  const invoicesToCreate = newRows.map((row: DWParsedRow) => ({
    reference_year: row.reference_year,
    reference_month: row.reference_month,
    year_sequence: nextSequence++,
    property_code: row.property_code,
    property_address: row.property_address,
    client_name: row.client_name,
    client_cpf_cnpj: row.client_cpf_cnpj,
    service_type: row.service_type,
    title_number: row.title_number,
    due_date: row.due_date,
    amount: row.amount,
    description_title: row.description_title,
    description_body: row.description_body,
    status: "PENDENTE" as const,
    imported_from_dw: true,
    dw_agency_name: row.agency_name || null,
    notes: `Importado do DW em ${new Date().toLocaleDateString("pt-BR")}. Status DW: ${row.dw_status}. Histórico: ${row.historico}`,
    created_by: userId,
  }));

  try {
    const result = await prisma.invoice.createMany({
      data: invoicesToCreate,
      skipDuplicates: true, // Proteção extra contra race conditions
    });

    return NextResponse.json(
      {
        message: `${result.count} nota(s) fiscal(is) importada(s) com sucesso.`,
        imported: result.count,
        duplicates: previewRows.filter((r) => r.import_status === "duplicata").length,
        errors: parseResult.errors,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[import-dw] Erro ao salvar no banco:", err);
    return NextResponse.json(
      { error: "Erro interno ao salvar as notas. Tente novamente." },
      { status: 500 }
    );
  }
}
