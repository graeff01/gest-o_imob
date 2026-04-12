/**
 * POST /api/invoices/import-dw
 * ----------------------------
 * Recebe Excel do DW, faz parse, checa duplicatas e retorna preview.
 * Com ?confirm=true, persiste as linhas novas.
 * Fallback in-memory quando não há DATABASE_URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDWExcel, DWParsedRow } from "@/lib/utils/dw-parser";
import {
  findByTitleNumbers,
  createManyInvoices,
  getNextYearSequence,
} from "@/lib/stores/invoice-store";

const AUTHORIZED_ROLES = ["ADMIN_MASTER", "DONO"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

export async function POST(request: NextRequest) {
  // ── 1. Auth ──
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userRole = (session.user as Record<string, unknown>).role as string | undefined;
  if (!userRole || !AUTHORIZED_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const userId = session.user.id;

  // ── 2. File ──
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];
  const fileName = file.name.toLowerCase();
  if (!allowedTypes.includes(file.type) && !fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
    return NextResponse.json({ error: "Formato inválido. Envie .xlsx ou .xls." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: 10MB.` }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ── 3. Parse ──
  const parseResult = parseDWExcel(buffer);

  if (parseResult.rows.length === 0 && parseResult.errors.length > 0) {
    return NextResponse.json(
      { error: "Nenhuma linha válida encontrada.", parseErrors: parseResult.errors, totalRows: parseResult.totalRows },
      { status: 422 }
    );
  }

  // ── 4. Duplicatas — tenta Prisma, senão in-memory ──
  const titleNumbers = parseResult.rows.map((r) => r.title_number);
  let existingKeys: Set<string>;

  try {
    const existingInvoices = await prisma.invoice.findMany({
      where: { title_number: { in: titleNumbers } },
      select: { title_number: true, reference_year: true },
    });
    existingKeys = new Set(existingInvoices.map((inv) => `${inv.title_number}|${inv.reference_year}`));
  } catch {
    // Fallback in-memory
    const existingInvoices = findByTitleNumbers(titleNumbers);
    existingKeys = new Set(existingInvoices.map((inv) => `${inv.title_number}|${inv.reference_year}`));
  }

  const previewRows: PreviewRow[] = parseResult.rows.map((row) => {
    const key = `${row.title_number}|${row.reference_year}`;
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
      import_status: existingKeys.has(key) ? "duplicata" : "nova",
    };
  });

  const newRows = parseResult.rows.filter((row) => {
    const key = `${row.title_number}|${row.reference_year}`;
    return !existingKeys.has(key);
  });

  // ── 5. Preview vs confirm ──
  const confirm = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirm) {
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

  // ── 6. Persist ──
  if (newRows.length === 0) {
    return NextResponse.json({
      message: "Nenhuma nota nova para importar.",
      imported: 0,
      duplicates: previewRows.filter((r) => r.import_status === "duplicata").length,
    });
  }

  try {
    // Tenta Prisma
    const currentYear = new Date().getFullYear();
    const lastInvoice = await prisma.invoice.findFirst({
      where: { reference_year: currentYear },
      orderBy: { year_sequence: "desc" },
      select: { year_sequence: true },
    });
    let nextSequence = (lastInvoice?.year_sequence ?? 0) + 1;

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

    const result = await prisma.invoice.createMany({ data: invoicesToCreate, skipDuplicates: true });

    return NextResponse.json(
      { message: `${result.count} nota(s) importada(s) com sucesso.`, imported: result.count, duplicates: previewRows.filter((r) => r.import_status === "duplicata").length, errors: parseResult.errors },
      { status: 201 }
    );
  } catch {
    // Fallback in-memory
    const currentYear = new Date().getFullYear();
    let nextSequence = getNextYearSequence(currentYear);

    const records = newRows.map((row: DWParsedRow) => ({
      contract_id: null,
      nfse_number: null,
      year_sequence: nextSequence++,
      reference_year: row.reference_year,
      reference_month: row.reference_month,
      property_code: row.property_code,
      property_address: row.property_address,
      client_name: row.client_name,
      client_cpf_cnpj: row.client_cpf_cnpj,
      client_contact: null,
      service_type: row.service_type,
      title_number: row.title_number,
      due_date: row.due_date.toISOString().split("T")[0],
      amount: row.amount,
      description_title: row.description_title,
      description_body: row.description_body,
      status: "PENDENTE" as const,
      issued_at: null,
      sent_at: null,
      paid_at: null,
      cancelled_at: null,
      gateway_id: null,
      gateway_provider: null,
      gateway_status: null,
      gateway_pdf_url: null,
      gateway_xml_url: null,
      last_emit_error: null,
      last_emit_at: null,
      emit_attempts: 0,
      imported_from_dw: true,
      dw_agency_name: row.agency_name || null,
      notes: `Importado do DW em ${new Date().toLocaleDateString("pt-BR")}`,
      created_by: userId,
    }));

    const count = createManyInvoices(records);

    return NextResponse.json(
      { message: `${count} nota(s) importada(s) com sucesso (modo local).`, imported: count, duplicates: previewRows.filter((r) => r.import_status === "duplicata").length, errors: parseResult.errors },
      { status: 201 }
    );
  }
}
