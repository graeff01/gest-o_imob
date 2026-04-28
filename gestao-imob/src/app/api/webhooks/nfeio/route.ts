import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mapeamento dos eventos NFE.io → InvoiceStatus interno
const STATUS_MAP: Record<string, { status: "EMITIDA" | "ERRO" | "CANCELADA" } | null> = {
  "ServiceInvoice.Issued":    { status: "EMITIDA" },
  "ServiceInvoice.IssueFailed": { status: "ERRO" },
  "ServiceInvoice.IssueError":  { status: "ERRO" },
  "ServiceInvoice.Cancelled":   { status: "CANCELADA" },
};

export async function POST(req: NextRequest) {
  // Verificação de segredo HMAC (opcional — ative adicionando NFEIO_WEBHOOK_SECRET no Railway)
  const secret = process.env.NFEIO_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers.get("x-nfeio-signature") ?? req.headers.get("x-signature") ?? "";
    if (sig !== secret) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const event = body as {
    type?: string;
    data?: {
      object?: {
        id?: string;
        reference?: string;  // X-Request-Id que enviamos = nosso invoiceId
        number?: number;
        status?: string;
        pdfUrl?: string;
        xmlUrl?: string;
        message?: string;
      };
    };
  };

  const eventType  = event?.type ?? "";
  const obj        = event?.data?.object ?? {};
  const gatewayId  = obj.id ?? "";
  const reference  = obj.reference ?? "";  // nosso invoice ID
  const nfseNumber = obj.number ?? null;
  const pdfUrl     = obj.pdfUrl ?? null;
  const xmlUrl     = obj.xmlUrl ?? null;
  const rawMessage = obj.message ?? null;

  const mapping = STATUS_MAP[eventType];
  if (!mapping) {
    // Evento que não gerencia (ex: produto, GNRE) — aceita e ignora
    return NextResponse.json({ received: true });
  }

  // Localiza a nota pelo reference (nosso ID) ou pelo gateway_id
  let invoice = null;
  if (reference) {
    invoice = await prisma.invoice.findFirst({ where: { id: reference } });
  }
  if (!invoice && gatewayId) {
    invoice = await prisma.invoice.findFirst({ where: { gateway_id: gatewayId } });
  }

  if (!invoice) {
    // Pode ser nota de outro ambiente (HML vs PRD) — aceita sem erro para não gerar reenvio
    return NextResponse.json({ received: true, note: "invoice não encontrada" });
  }

  const updateData: Record<string, unknown> = {
    status:        mapping.status,
    gateway_status: obj.status ?? eventType,
  };

  if (nfseNumber) updateData.nfse_number     = nfseNumber;
  if (pdfUrl)     updateData.gateway_pdf_url  = pdfUrl;
  if (xmlUrl)     updateData.gateway_xml_url  = xmlUrl;

  if (mapping.status === "EMITIDA") {
    updateData.issued_at       = new Date();
    updateData.last_emit_error = null;
  } else if (mapping.status === "CANCELADA") {
    updateData.cancelled_at    = new Date();
    updateData.last_emit_error = rawMessage ?? eventType;
  } else if (mapping.status === "ERRO") {
    updateData.last_emit_error = rawMessage ?? eventType;
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data:  updateData,
  });

  return NextResponse.json({ received: true });
}
