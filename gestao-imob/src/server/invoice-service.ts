import { prisma } from "@/lib/prisma";
import { emitNfse } from "@/lib/utils/nfse-gateway";
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

async function nextYearSequence(referenceYear: number) {
  const lastInvoice = await prisma.invoice.findFirst({
    where: { reference_year: referenceYear },
    orderBy: { year_sequence: "desc" },
    select: { year_sequence: true },
  });
  return (lastInvoice?.year_sequence ?? 0) + 1;
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
  options: { cep?: string; aliquota?: number }
) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    throw new InvoiceServiceError("Nota fiscal nao encontrada.", 404);
  }

  if (["EMITIDA", "ENVIADA", "PAGA"].includes(invoice.status)) {
    return { alreadyIssued: true, invoice };
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
              municipio: "Porto Alegre",
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
      gateway_pdf_url: result.pdfUrl,
      gateway_xml_url: result.xmlUrl,
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
