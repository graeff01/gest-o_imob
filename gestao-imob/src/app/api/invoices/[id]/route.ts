import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, requireElevatedRole } from "@/server/authz";
import { updateInvoiceSchema } from "@/server/invoice-schemas";
import { InvoiceServiceError, updateInvoice } from "@/server/invoice-service";

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

  console.error("Invoice update error:", error);
  return NextResponse.json({ error: "Erro ao atualizar nota fiscal." }, { status: 500 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireElevatedRole();
    const { id } = await params;
    const input = updateInvoiceSchema.parse(await request.json());
    const invoice = await updateInvoice(id, input);

    return NextResponse.json({ invoice });
  } catch (error) {
    return errorResponse(error);
  }
}
