import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, requireElevatedRole } from "@/server/authz";
import { emitInvoiceSchema } from "@/server/invoice-schemas";
import { emitInvoice, InvoiceServiceError } from "@/server/invoice-service";

function errorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof InvoiceServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Dados invalidos.", issues: error.issues },
      { status: 400 }
    );
  }

  console.error("Invoice emit error:", error);
  return NextResponse.json({ error: "Erro ao emitir nota fiscal." }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireElevatedRole();
    const { id } = await params;

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const options = emitInvoiceSchema.parse(body);
    const result = await emitInvoice(id, options);

    if ("alreadyIssued" in result) {
      return NextResponse.json({
        message: "Nota ja emitida anteriormente.",
        invoice: result.invoice,
      });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: "Falha ao emitir a NFS-e.", details: result.error, invoice: result.invoice },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: result.stub
        ? "Nota registrada no sistema (modo desenvolvimento - nao enviada a prefeitura)."
        : "NFS-e emitida com sucesso.",
      stub: result.stub,
      invoice: result.invoice,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
