/**
 * POST /api/invoices/[id]/emit
 * ----------------------------
 * Emite uma NFS-e via gateway (stub em dev) para uma nota PENDENTE ou ERRO.
 * Com fallback in-memory quando não há DATABASE_URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { emitNfse } from "@/lib/utils/nfse-gateway";
import { findInvoiceById, updateInvoice } from "@/lib/stores/invoice-store";

const AUTHORIZED_ROLES = ["ADMIN_MASTER", "DONO"];
const EMITTABLE_STATUSES = ["PENDENTE", "ERRO"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── 1. Autenticação ──
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const userRole = (session.user as Record<string, unknown>).role as string | undefined;
  if (!userRole || !AUTHORIZED_ROLES.includes(userRole)) {
    return NextResponse.json(
      { error: "Sem permissão. Apenas ADMIN_MASTER e DONO podem emitir notas fiscais." },
      { status: 403 }
    );
  }

  const { id } = await params;

  // ── 2. Busca a nota — in-memory (sem banco configurado) ──
  const invoice = findInvoiceById(id);

  if (!invoice) {
    return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });
  }

  // ── 3. Idempotência ──
  if (["EMITIDA", "ENVIADA", "PAGA"].includes(invoice.status)) {
    return NextResponse.json({
      message: "Nota já emitida anteriormente.",
      invoice: {
        id: invoice.id, status: invoice.status,
        gateway_id: invoice.gateway_id, nfse_number: invoice.nfse_number,
        gateway_pdf_url: invoice.gateway_pdf_url,
      },
    });
  }

  // ── 4. Verifica status emitível ──
  if (!EMITTABLE_STATUSES.includes(invoice.status)) {
    return NextResponse.json(
      { error: `Não é possível emitir uma nota com status "${invoice.status}".` },
      { status: 409 }
    );
  }

  // ── 5. Marca como processando ──
  updateInvoice(id, {
    status: "PROCESSANDO",
    last_emit_at: new Date().toISOString(),
    emit_attempts: invoice.emit_attempts + 1,
  });

  // ── 6. Chama gateway (stub em dev) ──
  const result = await emitNfse({
    invoiceId: invoice.id,
    borrower: {
      name: invoice.client_name,
      federalTaxNumber: invoice.client_cpf_cnpj,
      email: invoice.client_contact ?? undefined,
    },
    service: {
      description: invoice.description_body,
      amount: invoice.amount,
      competence: {
        month: invoice.reference_month ?? new Date().getMonth() + 1,
        year: invoice.reference_year,
      },
    },
  });

  // ── 7. Atualiza com resultado ──
  if (result.success) {
    const updated = updateInvoice(id, {
      status: "EMITIDA",
      issued_at: new Date().toISOString(),
      gateway_id: result.gatewayId,
      gateway_provider: result.provider,
      gateway_status: result.gatewayStatus,
      gateway_pdf_url: result.pdfUrl,
      gateway_xml_url: result.xmlUrl,
      nfse_number: result.nfseNumber,
      last_emit_error: null,
    });

    return NextResponse.json({
      message: "NFS-e emitida com sucesso (modo stub).",
      invoice: {
        id: updated!.id,
        status: updated!.status,
        nfse_number: updated!.nfse_number,
        gateway_id: updated!.gateway_id,
        gateway_pdf_url: updated!.gateway_pdf_url,
        issued_at: updated!.issued_at,
      },
    });
  } else {
    updateInvoice(id, {
      status: "ERRO",
      gateway_status: "error",
      last_emit_error: result.error,
    });

    return NextResponse.json(
      { error: "Falha ao emitir a NFS-e.", details: result.error },
      { status: 502 }
    );
  }
}
