import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

// Garante runtime Node (não Edge) — precisamos de crypto e prisma.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — responde 200 para qualquer ping de health/teste
export async function GET() {
  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Mapeamento dos eventos NFE.io → InvoiceStatus interno
const STATUS_MAP: Record<string, "EMITIDA" | "ERRO" | "CANCELADA"> = {
  // NFS-e (caminho oficial)
  "service_invoice.issued":      "EMITIDA",
  "service_invoice.cancelled":   "CANCELADA",
  "service_invoice.error":       "ERRO",
  "service_invoice.failed":      "ERRO",
  // Variantes (alguns ambientes usam o nome do recurso em PascalCase)
  "ServiceInvoice.Issued":       "EMITIDA",
  "ServiceInvoice.Cancelled":    "CANCELADA",
  "ServiceInvoice.IssueFailed":  "ERRO",
  "ServiceInvoice.IssueError":   "ERRO",
};

function internalDocumentUrl(invoiceId: string, type: "pdf" | "xml") {
  return `/api/invoices/${invoiceId}/download?type=${type}`;
}

function verifyHmac(rawBody: string, headerSig: string | null, secret: string): boolean {
  if (!headerSig) return false;
  const expected = createHmac("sha1", secret).update(rawBody).digest("base64");
  const sig = headerSig.replace(/^sha1=/, "");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // Helper para logar e responder ao mesmo tempo
  async function logAndRespond(ctx: {
    eventType?: string | null;
    invoiceId?: string | null;
    gatewayId?: string | null;
    signatureValid?: boolean;
    processed?: boolean;
    error?: string | null;
    statusCode?: number;
    responseBody?: Record<string, unknown>;
  }) {
    try {
      await prisma.webhookLog.create({
        data: {
          provider:        "nfeio",
          event_type:      ctx.eventType ?? null,
          invoice_id:      ctx.invoiceId ?? null,
          gateway_id:      ctx.gatewayId ?? null,
          payload:         rawBody.slice(0, 50_000), // limita pra nao estourar
          signature_valid: ctx.signatureValid ?? true,
          processed:       ctx.processed ?? false,
          status_code:     ctx.statusCode ?? 200,
          error_message:   ctx.error ?? null,
          ip_address:      ip,
        },
      });
    } catch (err) {
      console.error("[nfeio-webhook] falha ao gravar log:", err);
    }
    return new NextResponse(JSON.stringify(ctx.responseBody ?? { ok: true }), {
      status: ctx.statusCode ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1) Validação inicial do NFE.io: corpo vazio → 200 imediato
  if (!rawBody || rawBody.trim().length === 0) {
    return logAndRespond({ eventType: "validation.ping", processed: false });
  }

  // 2) Verificação opcional de HMAC
  const secret = process.env.NFEIO_WEBHOOK_SECRET;
  let signatureValid = true;
  if (secret) {
    const sig =
      req.headers.get("x-hub-signature") ??
      req.headers.get("x-nfeio-signature") ??
      req.headers.get("x-nfe-signature") ??
      req.headers.get("x-signature");
    signatureValid = verifyHmac(rawBody, sig, secret);
    if (!signatureValid) {
      return logAndRespond({
        signatureValid: false,
        error: "assinatura HMAC invalida",
        responseBody: { ok: true, ignored: "bad-signature" },
      });
    }
  }

  // 3) Parse do JSON
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return logAndRespond({
      signatureValid,
      error: "JSON invalido",
      responseBody: { ok: true, ignored: "invalid-json" },
    });
  }

  const body = parsed as {
    event?: string;
    type?: string;
    data?: Record<string, unknown> & { object?: Record<string, unknown> };
  };

  const eventName = body.event ?? body.type ?? "";
  const obj =
    (body.data?.object as Record<string, unknown> | undefined) ??
    (body.data as Record<string, unknown> | undefined) ??
    {};

  const gatewayId  = (obj.id ?? obj.Id ?? "") as string;
  const externalId = (obj.externalId ?? obj.external_id ?? obj.reference ?? "") as string;

  const newStatus = STATUS_MAP[eventName];
  if (!newStatus) {
    return logAndRespond({
      eventType: eventName,
      gatewayId,
      signatureValid,
      processed: false,
      responseBody: { ok: true, ignored: eventName || "unknown-event" },
    });
  }

  // 4) Localiza a nota
  const nfseNumber = obj.number ? Number(obj.number) : null;
  const pdfUrl     = (obj.pdfUrl ?? obj.pdf_url ?? null) as string | null;
  const xmlUrl     = (obj.xmlUrl ?? obj.xml_url ?? null) as string | null;
  const message    = (obj.message ?? obj.flowMessage ?? null) as string | null;

  let invoice = null;
  if (gatewayId) {
    invoice = await prisma.invoice.findFirst({ where: { gateway_id: gatewayId } });
  }
  if (!invoice && externalId) {
    invoice = await prisma.invoice.findFirst({ where: { id: externalId } });
  }

  if (!invoice) {
    return logAndRespond({
      eventType: eventName,
      gatewayId,
      signatureValid,
      processed: false,
      error: "invoice nao encontrada",
      responseBody: { ok: true, note: "invoice nao encontrada" },
    });
  }

  const updateData: Record<string, unknown> = {
    status:         newStatus,
    gateway_status: (obj.status as string) ?? eventName,
  };
  if (nfseNumber) updateData.nfse_number     = nfseNumber;
  if (pdfUrl)     updateData.gateway_pdf_url = pdfUrl;
  if (xmlUrl)     updateData.gateway_xml_url = xmlUrl;

  if (newStatus === "EMITIDA") {
    if (!invoice.issued_at) updateData.issued_at = new Date();
    updateData.gateway_pdf_url = pdfUrl ?? internalDocumentUrl(invoice.id, "pdf");
    updateData.gateway_xml_url = xmlUrl ?? internalDocumentUrl(invoice.id, "xml");
    updateData.last_emit_error = null;
    updateData.retry_after = null;
  } else if (newStatus === "CANCELADA") {
    if (!invoice.cancelled_at) updateData.cancelled_at = new Date();
    updateData.last_emit_error = message ?? eventName;
  } else if (newStatus === "ERRO") {
    updateData.last_emit_error = message ?? eventName;
    // Permite retry automatico em 5min
    updateData.retry_after = new Date(Date.now() + 5 * 60 * 1000);
  }

  try {
    await prisma.invoice.update({ where: { id: invoice.id }, data: updateData });
  } catch (err) {
    return logAndRespond({
      eventType: eventName,
      invoiceId: invoice.id,
      gatewayId,
      signatureValid,
      processed: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return logAndRespond({
    eventType: eventName,
    invoiceId: invoice.id,
    gatewayId,
    signatureValid,
    processed: true,
  });
}
