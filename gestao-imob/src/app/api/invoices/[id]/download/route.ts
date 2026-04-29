import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireElevatedRole } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { downloadNfseDocument, type NfseDocumentType } from "@/lib/utils/nfse-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDocumentType(value: string | null): NfseDocumentType | null {
  if (value === "pdf" || value === "xml") return value;
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireElevatedRole();

    const { id } = await params;
    const type = parseDocumentType(req.nextUrl.searchParams.get("type"));
    if (!type) {
      return NextResponse.json({ error: "Tipo de documento invalido." }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        gateway_id: true,
        nfse_number: true,
        reference_year: true,
        year_sequence: true,
        status: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Nota nao encontrada." }, { status: 404 });
    }

    if (!invoice.gateway_id || invoice.status !== "EMITIDA") {
      return NextResponse.json({ error: "Documento fiscal ainda nao esta disponivel." }, { status: 409 });
    }

    const result = await downloadNfseDocument(invoice.gateway_id, type);
    if (!result.success || !result.content) {
      return NextResponse.json({ error: result.error ?? "Falha ao baixar documento." }, { status: 502 });
    }

    const suffix = invoice.nfse_number
      ? String(invoice.nfse_number).padStart(6, "0")
      : `${invoice.reference_year}-${invoice.year_sequence ?? invoice.id.slice(0, 8)}`;
    const filename = `nfse-${suffix}.${type}`;

    return new NextResponse(Buffer.from(result.content), {
      headers: {
        "Content-Type": result.contentType ?? (type === "pdf" ? "application/pdf" : "application/xml"),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Download NFS-e document error:", error);
    return NextResponse.json({ error: "Erro interno ao baixar documento." }, { status: 500 });
  }
}
