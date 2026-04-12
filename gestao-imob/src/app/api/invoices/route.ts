import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findManyInvoices,
  createInvoice,
  getNextYearSequence,
} from "@/lib/stores/invoice-store";

// ─── GET — lista notas fiscais com filtros ───────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const year = searchParams.get("year");
  const search = searchParams.get("search");
  const serviceType = searchParams.get("service_type");

  try {
    // Tenta Prisma primeiro
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (year) where.reference_year = Number(year);
    if (serviceType) where.service_type = serviceType;

    if (search) {
      where.OR = [
        { client_name: { contains: search, mode: "insensitive" } },
        { client_cpf_cnpj: { contains: search } },
        { property_address: { contains: search, mode: "insensitive" } },
        { description_title: { contains: search, mode: "insensitive" } },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: { contract: true },
      orderBy: { created_at: "desc" },
      take: 200,
    });

    return NextResponse.json({ invoices, summary: buildSummary(invoices) });
  } catch {
    // Fallback: store in-memory
    const invoices = findManyInvoices({
      status: status || undefined,
      search: search || undefined,
      service_type: serviceType || undefined,
      year: year ? Number(year) : undefined,
    });

    return NextResponse.json({ invoices, summary: buildSummary(invoices) });
  }
}

// ─── POST — cria nova nota fiscal ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contract_id,
      reference_year,
      reference_month,
      property_code,
      property_address,
      client_name,
      client_cpf_cnpj,
      client_contact,
      service_type,
      title_number,
      amount,
      description_title,
      description_body,
      notes,
      created_by,
    } = body;

    if (!client_name || !client_cpf_cnpj || !service_type || !amount || !description_title || !description_body || !created_by) {
      return NextResponse.json({ error: "Campos obrigatórios não preenchidos" }, { status: 400 });
    }

    const yr = reference_year || new Date().getFullYear();

    try {
      // Tenta Prisma
      const lastInvoice = await prisma.invoice.findFirst({
        where: { reference_year: yr },
        orderBy: { year_sequence: "desc" },
      });
      const yearSequence = (lastInvoice?.year_sequence || 0) + 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = await (prisma.invoice as any).create({
        data: {
          contract_id: contract_id || null,
          reference_year: yr,
          reference_month: reference_month || null,
          year_sequence: yearSequence,
          property_code: property_code || null,
          property_address: property_address || null,
          client_name,
          client_cpf_cnpj,
          client_contact: client_contact || null,
          service_type,
          title_number: title_number || null,
          amount: parseFloat(amount),
          description_title,
          description_body,
          status: "PENDENTE",
          notes: notes || null,
          created_by,
        },
      });

      return NextResponse.json({ invoice }, { status: 201 });
    } catch {
      // Fallback: store in-memory
      const yearSequence = getNextYearSequence(yr);

      const invoice = createInvoice({
        contract_id: contract_id || null,
        nfse_number: null,
        year_sequence: yearSequence,
        reference_year: yr,
        reference_month: reference_month || null,
        property_code: property_code || null,
        property_address: property_address || null,
        client_name,
        client_cpf_cnpj,
        client_contact: client_contact || null,
        service_type,
        title_number: title_number || null,
        amount: parseFloat(amount),
        description_title,
        description_body,
        status: "PENDENTE",
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
        imported_from_dw: false,
        dw_agency_name: null,
        notes: notes || null,
        due_date: null,
        created_by,
      });

      return NextResponse.json({ invoice }, { status: 201 });
    }
  } catch (err) {
    console.error("Invoice create error:", err);
    return NextResponse.json({ error: "Erro ao criar nota fiscal" }, { status: 500 });
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function buildSummary(invoices: { status: string; amount: number | unknown }[]) {
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
