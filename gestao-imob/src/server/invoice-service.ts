import { prisma } from "@/lib/prisma";
import { emitNfse } from "@/lib/utils/nfse-gateway";
import { validateCNPJ, validateCPF } from "@/lib/utils";
import { auditEvent } from "@/server/audit";
import type {
  CreateInvoiceInput,
  InvoiceFilters,
  UpdateInvoiceInput,
} from "@/server/invoice-schemas";

type InvoiceStatus =
  | "PENDENTE"
  | "PROCESSANDO"
  | "EMITIDA"
  | "ENVIADA"
  | "PAGA"
  | "CANCELADA"
  | "ERRO";

const allowedTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  PENDENTE: ["PROCESSANDO", "CANCELADA"],
  PROCESSANDO: ["EMITIDA", "ERRO"],
  ERRO: ["PROCESSANDO", "CANCELADA"],
  EMITIDA: ["ENVIADA", "PAGA", "CANCELADA"],
  ENVIADA: ["PAGA", "CANCELADA"],
  PAGA: [],
  CANCELADA: [],
};

function internalDocumentUrl(invoiceId: string, type: "pdf" | "xml") {
  return `/api/invoices/${invoiceId}/download?type=${type}`;
}

const duplicateBlockingStatuses: InvoiceStatus[] = ["PROCESSANDO", "EMITIDA", "ENVIADA", "PAGA"];

export class InvoiceServiceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function assertTransition(from: InvoiceStatus, to: InvoiceStatus) {
  if (from === to) return;
  if (!allowedTransitions[from]?.includes(to)) {
    throw new InvoiceServiceError(
      `Transicao de status invalida: ${from} -> ${to}.`,
      409
    );
  }
}

function isValidCpfCnpj(value: string) {
  const clean = value.replace(/\D/g, "");
  if (clean.length === 11) return validateCPF(clean);
  if (clean.length === 14) return validateCNPJ(clean);
  return false;
}

function assertReadyToEmit(
  invoice: {
    client_name: string;
    client_cpf_cnpj: string;
    amount: unknown;
    reference_month: number | null;
    reference_year: number;
    description_body: string;
    service_type: string;
  },
  options: { cep?: string; aliquota?: number }
) {
  const issues: string[] = [];
  if (invoice.client_name.trim().length < 2) issues.push("tomador sem nome valido");
  if (!isValidCpfCnpj(invoice.client_cpf_cnpj)) issues.push("CPF/CNPJ do tomador invalido");
  if (!Number.isFinite(Number(invoice.amount)) || Number(invoice.amount) <= 0) issues.push("valor deve ser maior que zero");
  if (!invoice.reference_month || !invoice.reference_year) issues.push("competencia incompleta");
  if (invoice.description_body.trim().length < 15) issues.push("descricao da NFS-e muito curta");
  if (!["INTERMEDIACAO", "AGENCIAMENTO", "ADMINISTRACAO"].includes(invoice.service_type)) issues.push("tipo de servico invalido");
  if (!options.cep || options.cep.replace(/\D/g, "").length !== 8) issues.push("CEP obrigatorio para emissao");
  if (options.aliquota !== undefined && (!Number.isFinite(options.aliquota) || options.aliquota < 0 || options.aliquota > 100)) {
    issues.push("aliquota invalida");
  }

  if (issues.length > 0) {
    throw new InvoiceServiceError(`Nota incompleta para emissao: ${issues.join("; ")}.`, 422);
  }
}

async function nextYearSequence(referenceYear: number) {
  const lastInvoice = await prisma.invoice.findFirst({
    where: { reference_year: referenceYear },
    orderBy: { year_sequence: "desc" },
    select: { year_sequence: true },
  });
  return (lastInvoice?.year_sequence ?? 0) + 1;
}

async function findBlockingDuplicate(invoice: {
  id: string;
  title_number: string | null;
  client_cpf_cnpj: string;
  reference_month: number | null;
  reference_year: number;
  amount: unknown;
}) {
  const cleanDocument = invoice.client_cpf_cnpj.replace(/\D/g, "");
  const duplicateOr: Record<string, unknown>[] = [];

  if (invoice.title_number) {
    duplicateOr.push({
      title_number: invoice.title_number,
      client_cpf_cnpj: cleanDocument,
      reference_year: invoice.reference_year,
    });
  }

  duplicateOr.push({
    client_cpf_cnpj: cleanDocument,
    reference_month: invoice.reference_month,
    reference_year: invoice.reference_year,
    amount: invoice.amount,
  });

  return prisma.invoice.findFirst({
    where: {
      id: { not: invoice.id },
      status: { in: duplicateBlockingStatuses },
      OR: duplicateOr,
    },
    orderBy: { updated_at: "desc" },
    select: {
      id: true,
      nfse_number: true,
      year_sequence: true,
      reference_year: true,
      reference_month: true,
      client_name: true,
      amount: true,
      status: true,
      title_number: true,
    },
  });
}

export function buildInvoiceSummary(
  invoices: Array<{ status: string; amount: number | unknown }>
) {
  return {
    total: invoices.length,
    pendentes: invoices.filter((i) => i.status === "PENDENTE").length,
    emitidas: invoices.filter((i) => i.status === "EMITIDA").length,
    enviadas: invoices.filter((i) => i.status === "ENVIADA").length,
    pagas: invoices.filter((i) => i.status === "PAGA").length,
    canceladas: invoices.filter((i) => i.status === "CANCELADA").length,
    totalAmount: invoices.reduce((s, i) => s + Number(i.amount), 0),
  };
}

export async function listInvoices(filters: InvoiceFilters) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.year) where.reference_year = filters.year;
  if (filters.service_type) where.service_type = filters.service_type;

  if (filters.search) {
    where.OR = [
      { client_name: { contains: filters.search, mode: "insensitive" } },
      { client_cpf_cnpj: { contains: filters.search.replace(/\D/g, "") || filters.search } },
      { property_address: { contains: filters.search, mode: "insensitive" } },
      { description_title: { contains: filters.search, mode: "insensitive" } },
      { title_number: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { contract: true },
    orderBy: { created_at: "desc" },
    take: 200,
  });

  return { invoices, summary: buildInvoiceSummary(invoices) };
}

export async function createInvoice(input: CreateInvoiceInput, createdBy: string) {
  const yearSequence = await nextYearSequence(input.reference_year);

  const invoice = await prisma.invoice.create({
    data: {
      contract_id: input.contract_id ?? null,
      reference_year: input.reference_year,
      reference_month: input.reference_month ?? null,
      year_sequence: yearSequence,
      property_code: input.property_code ?? null,
      property_address: input.property_address ?? null,
      client_name: input.client_name,
      client_cpf_cnpj: input.client_cpf_cnpj,
      client_contact: input.client_contact ?? null,
      service_type: input.service_type,
      title_number: input.title_number ?? null,
      due_date: input.due_date ?? null,
      amount: input.amount,
      description_title: input.description_title,
      description_body: input.description_body,
      status: "PENDENTE",
      notes: input.notes ?? null,
      created_by: createdBy,
    },
  });

  await auditEvent({
    action: "invoice.created",
    actorId: createdBy,
    entityId: invoice.id,
    entityType: "invoice",
    summary: "Nota fiscal criada manualmente.",
    metadata: { service_type: invoice.service_type, amount: Number(invoice.amount) },
  });

  return invoice;
}

export async function updateInvoice(
  id: string,
  input: UpdateInvoiceInput
) {
  const current = await prisma.invoice.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!current) {
    throw new InvoiceServiceError("Nota fiscal nao encontrada.", 404);
  }

  if (input.status) {
    assertTransition(current.status as InvoiceStatus, input.status as InvoiceStatus);
  }

  const data: Record<string, unknown> = {};
  if (input.status) data.status = input.status;
  if ("notes" in input) data.notes = input.notes ?? null;

  if (input.status === "ENVIADA") data.sent_at = input.sent_at ?? new Date();
  if (input.status === "PAGA") data.paid_at = input.paid_at ?? new Date();
  if (input.status === "CANCELADA") data.cancelled_at = input.cancelled_at ?? new Date();

  const invoice = await prisma.invoice.update({ where: { id }, data });

  await auditEvent({
    action: "invoice.updated",
    entityId: id,
    entityType: "invoice",
    summary: input.status
      ? `Status da nota alterado de ${current.status} para ${input.status}.`
      : "Nota fiscal atualizada.",
    metadata: { status_from: current.status, status_to: input.status },
  });

  return invoice;
}

export async function emitInvoice(
  id: string,
  options: { cep?: string; aliquota?: number; confirmDuplicate?: boolean }
) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    throw new InvoiceServiceError("Nota fiscal nao encontrada.", 404);
  }

  if (["EMITIDA", "ENVIADA", "PAGA"].includes(invoice.status)) {
    return { alreadyIssued: true, invoice };
  }

  assertReadyToEmit(invoice, options);

  const duplicate = await findBlockingDuplicate(invoice);
  if (duplicate && !options.confirmDuplicate) {
    throw new InvoiceServiceError(
      `Possivel duplicidade bloqueada: ja existe uma nota ${duplicate.status.toLowerCase()} para o mesmo titulo DW ou mesmo cliente, competencia e valor.`,
      409
    );
  }

  assertTransition(invoice.status as InvoiceStatus, "PROCESSANDO");

  const processing = await prisma.invoice.update({
    where: { id },
    data: {
      status: "PROCESSANDO",
      last_emit_at: new Date(),
      emit_attempts: { increment: 1 },
    },
  });

  await auditEvent({
    action: "invoice.emit.attempted",
    entityId: id,
    entityType: "invoice",
    summary: "Tentativa de emissao de NFS-e iniciada.",
    metadata: { status_from: invoice.status, aliquota: options.aliquota },
  });

  const result = await emitNfse({
    invoiceId: processing.id,
    borrower: {
      name: processing.client_name,
      federalTaxNumber: processing.client_cpf_cnpj,
      email: processing.client_contact ?? undefined,
      ...(options.cep || processing.property_address
        ? {
            address: {
              cep: options.cep ?? "",
              logradouro: processing.property_address ?? undefined,
              municipio: "Canoas",
              uf: "RS",
            },
          }
        : {}),
    },
    service: {
      description: processing.description_body,
      amount: Number(processing.amount),
      competence: {
        month: processing.reference_month ?? new Date().getMonth() + 1,
        year: processing.reference_year,
      },
      ...(options.aliquota !== undefined ? { aliquota: options.aliquota } : {}),
    },
  });

  if (!result.success) {
    const failed = await prisma.invoice.update({
      where: { id },
      data: {
        status: "ERRO",
        gateway_status: "error",
        last_emit_error: result.error,
      },
    });

    await auditEvent({
      action: "invoice.emit.failed",
      entityId: id,
      entityType: "invoice",
      summary: "Emissao de NFS-e falhou.",
      metadata: { error: result.error },
    });

    return { success: false as const, error: result.error, invoice: failed };
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: "EMITIDA",
      issued_at: new Date(),
      gateway_id: result.gatewayId,
      gateway_provider: result.provider,
      gateway_status: result.gatewayStatus,
      gateway_pdf_url: result.pdfUrl ?? (result.provider !== "stub" ? internalDocumentUrl(id, "pdf") : null),
      gateway_xml_url: result.xmlUrl ?? (result.provider !== "stub" ? internalDocumentUrl(id, "xml") : null),
      nfse_number: result.nfseNumber,
      last_emit_error: null,
    },
  });

  await auditEvent({
    action: "invoice.emit.succeeded",
    entityId: id,
    entityType: "invoice",
    summary: result.provider === "stub" ? "Emissao registrada em modo stub." : "NFS-e emitida com sucesso.",
    metadata: { provider: result.provider, gateway_status: result.gatewayStatus },
  });

  return {
    success: true as const,
    stub: result.provider === "stub",
    invoice: updated,
  };
}
