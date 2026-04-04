import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const year = searchParams.get("year");
  const search = searchParams.get("search");
  const serviceType = searchParams.get("service_type");

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

  const summary = {
    total: invoices.length,
    pendentes: invoices.filter((i) => i.status === "PENDENTE").length,
    emitidas: invoices.filter((i) => i.status === "EMITIDA").length,
    enviadas: invoices.filter((i) => i.status === "ENVIADA").length,
    pagas: invoices.filter((i) => i.status === "PAGA").length,
    canceladas: invoices.filter((i) => i.status === "CANCELADA").length,
    totalAmount: invoices.reduce((s, i) => s + Number(i.amount), 0),
  };

  return NextResponse.json({ invoices, summary });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contract_id,
      reference_year,
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

    // Auto-generate nfse_number and year_sequence
    const lastInvoice = await prisma.invoice.findFirst({
      where: { reference_year: reference_year || new Date().getFullYear() },
      orderBy: { year_sequence: "desc" },
    });
    const yearSequence = (lastInvoice?.year_sequence || 0) + 1;

    const invoice = await prisma.invoice.create({
      data: {
        contract_id: contract_id || null,
        reference_year: reference_year || new Date().getFullYear(),
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
  } catch (err) {
    console.error("Invoice create error:", err);
    return NextResponse.json({ error: "Erro ao criar nota fiscal" }, { status: 500 });
  }
}
