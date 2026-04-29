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
  // 1) Lê o corpo bruto (necessário para HMAC)
  const rawBody = await req.text();

  // 2) Validação inicial do NFE.io: corpo vazio → 200 imediato
  if (!rawBody || rawBody.trim().length === 0) {
    return new NextResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3) Verificação opcional de HMAC
  const secret = process.env.NFEIO_WEBHOOK_SECRET;
  if (secret) {
    const sig =
      req.headers.get("x-hub-signature") ??
      req.headers.get("x-nfeio-signature") ??
      req.headers.get("x-nfe-signature") ??
      req.headers.get("x-signature");
    if (!verifyHmac(rawBody, sig, secret)) {
      // Mesmo com assinatura inválida devolvemos 200 para não bloquear validação;
      // log para auditoria.
      console.warn("[nfeio-webhook] assinatura HMAC invalida — ignorando payload");
      return new NextResponse(JSON.stringify({ ok: true, ignored: "bad-signature" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 4) Parse do JSON (sem quebrar a resposta se vier malformado)
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new NextResponse(JSON.stringify({ ok: true, ignored: "invalid-json" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = parsed as {
    event?: string;
    type?: string;
    data?: Record<string, unknown> & { object?: Record<string, unknown> };
  };

  const eventName = body.event ?? body.type ?? "";
  // O objeto da nota pode vir em data direto ou em data.object (variantes)
  const obj =
    (body.data?.object as Record<string, unknown> | undefined) ??
    (body.data as Record<string, unknown> | undefined) ??
    {};

  const newStatus = STATUS_MAP[eventName];
  if (!newStatus) {
    // Evento que não gerenciamos — aceita sem erro
    return new NextResponse(JSON.stringify({ ok: true, ignored: eventName || "unknown-event" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5) Localiza a nota por gateway_id ou por externalId (X-Request-Id que enviamos)
  const gatewayId  = (obj.id ?? obj.Id ?? "") as string;
  const externalId = (obj.externalId ?? obj.external_id ?? obj.reference ?? "") as string;
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
    return new NextResponse(JSON.stringify({ ok: true, note: "invoice nao encontrada" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
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
    updateData.last_emit_error = null;
  } else if (newStatus === "CANCELADA") {
    if (!invoice.cancelled_at) updateData.cancelled_at = new Date();
    updateData.last_emit_error = message ?? eventName;
  } else if (newStatus === "ERRO") {
    updateData.last_emit_error = message ?? eventName;
  }

  await prisma.invoice.update({ where: { id: invoice.id }, data: updateData });

  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
