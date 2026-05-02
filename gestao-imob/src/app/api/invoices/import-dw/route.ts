/**
 * POST /api/invoices/import-dw
 * ----------------------------
 * Recebe Excel do DW, faz parse, checa duplicatas e retorna preview.
 * Com ?confirm=true, persiste as linhas novas.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDWExcel, DWParsedRow } from "@/lib/utils/dw-parser";
import { auditEvent } from "@/server/audit";
import { AuthError, requireElevatedRole } from "@/server/authz";
import { appConfig } from "@/server/env";

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
  let userId: string;
  try {
    const ctx = await requireElevatedRole();
    userId = ctx.dbUserId;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Invoice DW import auth error:", error);
    return NextResponse.json({ error: "Erro de autenticacao." }, { status: 500 });
  }

  // Verifica tamanho ANTES de parsear formData (que tem limite proprio do Next).
  // Se nao checar aqui, request.formData() falha com erro generico em arquivos grandes.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Arquivo muito grande (${(contentLength / 1024 / 1024).toFixed(1)}MB). Limite: 10MB.` },
      { status: 413 }
    );
  }

  // ── 2. File ──
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    // Body parsing falhou — quase sempre é tamanho excedido.
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    if (msg.includes("body") && (msg.includes("size") || msg.includes("limit") || msg.includes("large"))) {
      return NextResponse.json(
        { error: "Arquivo excede o limite de 10MB. Reduza o tamanho e tente novamente." },
        { status: 413 }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível ler o arquivo. Verifique se ele não está corrompido e se o tamanho é menor que 10MB." },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/csv",
    "text/plain",
  ];
  const fileName = file.name.toLowerCase();
  const validExt = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv");
  if (!allowedTypes.includes(file.type) && !validExt) {
    return NextResponse.json({ error: "Formato inválido. Envie .xlsx, .xls ou .csv." }, { status: 400 });
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

  // ── 4. Duplicatas ──
  const titleNumbers = parseResult.rows.map((r) => r.title_number);
  const existingInvoices = await prisma.invoice.findMany({
    where: { title_number: { in: titleNumbers } },
    select: { title_number: true, reference_year: true, client_cpf_cnpj: true },
  });
  const existingKeys = new Set(existingInvoices.map((inv) => `${inv.title_number}|${inv.reference_year}|${inv.client_cpf_cnpj}`));

  const previewRows: PreviewRow[] = parseResult.rows.map((row) => {
    const key = `${row.title_number}|${row.reference_year}|${row.client_cpf_cnpj}`;
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
    const key = `${row.title_number}|${row.reference_year}|${row.client_cpf_cnpj}`;
    return !existingKeys.has(key);
  });

  // ── 5. Preview vs confirm ──
  const confirm = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirm) {
    await auditEvent({
      action: "invoice.import.previewed",
      actorId: userId,
      entityType: "import_batch",
      summary: "Preview de importacao DW gerado.",
      metadata: {
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        newRows: newRows.length,
        duplicateRows: previewRows.filter((r) => r.import_status === "duplicata").length,
        errorRows: parseResult.errors.length,
      },
    });

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

  const years = [...new Set(newRows.map((row) => row.reference_year))];
  const nextSequenceByYear = new Map<number, number>();

  for (const year of years) {
    const lastInvoice = await prisma.invoice.findFirst({
      where: { reference_year: year },
      orderBy: { year_sequence: "desc" },
      select: { year_sequence: true },
    });
    nextSequenceByYear.set(year, (lastInvoice?.year_sequence ?? 0) + 1);
  }

  const invoicesToCreate = newRows.map((row: DWParsedRow) => {
    const sequence = nextSequenceByYear.get(row.reference_year) ?? 1;
    nextSequenceByYear.set(row.reference_year, sequence + 1);

    return {
      reference_year: row.reference_year,
      reference_month: row.reference_month,
      year_sequence: sequence,
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
      notes: `Importado do DW em ${new Date().toLocaleDateString("pt-BR")}. Status DW: ${row.dw_status}. Historico: ${row.historico}`,
      created_by: userId,
    };
  });

  const result = await prisma.invoice.createMany({ data: invoicesToCreate, skipDuplicates: true });

  await auditEvent({
    action: "invoice.import.confirmed",
    actorId: userId,
    entityType: "import_batch",
    summary: "Importacao DW confirmada.",
    metadata: {
      imported: result.count,
      duplicates: previewRows.filter((r) => r.import_status === "duplicata").length,
      errors: parseResult.errors.length,
    },
  });

  return NextResponse.json(
    {
      message: `${result.count} nota(s) importada(s) com sucesso.`,
      imported: result.count,
      duplicates: previewRows.filter((r) => r.import_status === "duplicata").length,
      errors: parseResult.errors,
    },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest) {
  let userId: string;
  try {
    const ctx = await requireElevatedRole();
    userId = ctx.dbUserId;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Invoice DW cleanup auth error:", error);
    return NextResponse.json({ error: "Erro de autenticacao." }, { status: 500 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") !== "false";
  const scope = request.nextUrl.searchParams.get("scope") ?? "pending";
  const deleteAllDw = scope === "all";

  if (deleteAllDw && !appConfig.isHomolog) {
    return NextResponse.json(
      { error: "Limpeza total de notas DW e permitida somente em homologacao." },
      { status: 403 }
    );
  }

  const where = deleteAllDw
    ? { imported_from_dw: true }
    : {
        imported_from_dw: true,
        status: "PENDENTE" as const,
      };

  if (dryRun) {
    const count = await prisma.invoice.count({ where });
    return NextResponse.json({
      dryRun: true,
      removable: count,
      scope: deleteAllDw ? "all" : "pending",
      message: deleteAllDw
        ? "Simulacao concluida. Use ?scope=all&dryRun=false para remover todas as notas DW."
        : "Simulacao concluida. Use ?dryRun=false para remover as notas DW pendentes.",
    });
  }

  const result = await prisma.invoice.deleteMany({ where });

  await auditEvent({
    action: "invoice.import.cleaned",
    actorId: userId,
    entityType: "invoice",
    summary: deleteAllDw ? "Todas as notas DW removidas em ambiente nao produtivo." : "Notas DW pendentes removidas.",
    metadata: {
      deleted: result.count,
      scope: deleteAllDw ? "imported_from_dw=true" : "imported_from_dw=true,status=PENDENTE",
    },
  });

  return NextResponse.json({
    deleted: result.count,
    scope: deleteAllDw ? "all" : "pending",
    message: deleteAllDw
      ? `${result.count} nota(s) DW removida(s).`
      : `${result.count} nota(s) DW pendente(s) removida(s).`,
  });
}
