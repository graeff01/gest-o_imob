import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireElevatedRole } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { syncNfseStatus } from "@/lib/utils/nfse-gateway";

const ISSUED_STATUSES   = new Set(["Issued", "issued", "Created", "created", "Normal", "normal"]);
const ERROR_STATUSES    = new Set(["IssueFailed", "Error", "error", "Cancelled", "cancelled"]);
const CANCELLED_STATUSES = new Set(["Cancelled", "cancelled", "Cancelado"]);

function internalDocumentUrl(invoiceId: string, type: "pdf" | "xml") {
  return `/api/invoices/${invoiceId}/download?type=${type}`;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireElevatedRole();
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: "Nota não encontrada." }, { status: 404 });
    }

    if (!invoice.gateway_id) {
      return NextResponse.json({ error: "Nota sem gateway_id — ainda não foi enviada ao gateway." }, { status: 400 });
    }

    const result = await syncNfseStatus(invoice.gateway_id);

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Erro ao consultar gateway." }, { status: 502 });
    }

    // Determina novo status interno
    let newStatus = invoice.status;
    if (CANCELLED_STATUSES.has(result.gatewayStatus)) {
      newStatus = "CANCELADA";
    } else if (ERROR_STATUSES.has(result.gatewayStatus)) {
      newStatus = "ERRO";
    } else if (ISSUED_STATUSES.has(result.gatewayStatus) && invoice.status !== "CANCELADA") {
      newStatus = "EMITIDA";
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status:         newStatus,
        gateway_status: result.gatewayStatus,
        ...(result.nfseNumber ? { nfse_number: result.nfseNumber } : {}),
        ...(newStatus === "EMITIDA"
          ? {
              gateway_pdf_url: result.pdfUrl ?? invoice.gateway_pdf_url ?? internalDocumentUrl(id, "pdf"),
              gateway_xml_url: result.xmlUrl ?? invoice.gateway_xml_url ?? internalDocumentUrl(id, "xml"),
            }
          : {}),
        ...(newStatus === "EMITIDA" && !invoice.issued_at ? { issued_at: new Date() } : {}),
        ...(newStatus === "CANCELADA" && !invoice.cancelled_at ? { cancelled_at: new Date() } : {}),
      },
    });

    return NextResponse.json({ invoice: updated, gatewayStatus: result.gatewayStatus });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Sync NFS-e error:", error);
    return NextResponse.json({ error: "Erro interno ao sincronizar." }, { status: 500 });
  }
}
