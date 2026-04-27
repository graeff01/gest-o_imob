import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, requireAuth, requireElevatedRole } from "@/server/authz";
import {
  createInvoiceSchema,
  invoiceFiltersSchema,
} from "@/server/invoice-schemas";
import {
  createInvoice,
  InvoiceServiceError,
  listInvoices,
} from "@/server/invoice-service";

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

  console.error("Invoices API error:", error);
  return NextResponse.json({ error: "Erro interno em notas fiscais." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const filters = invoiceFiltersSchema.parse({
      status: request.nextUrl.searchParams.get("status") || undefined,
      year: request.nextUrl.searchParams.get("year") || undefined,
      search: request.nextUrl.searchParams.get("search") || undefined,
      service_type: request.nextUrl.searchParams.get("service_type") || undefined,
    });

    const result = await listInvoices(filters);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireElevatedRole();
    const body = await request.json();
    const input = createInvoiceSchema.parse(body);
    const invoice = await createInvoice(input, ctx.dbUserId);

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
