import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateInvoice } from "@/lib/stores/invoice-store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    try {
      // Tenta Prisma
      const invoice = await prisma.invoice.update({
        where: { id },
        data: body,
      });
      return NextResponse.json({ invoice });
    } catch {
      // Fallback: store in-memory
      const invoice = updateInvoice(id, body);
      if (!invoice) {
        return NextResponse.json({ error: "Nota fiscal não encontrada" }, { status: 404 });
      }
      return NextResponse.json({ invoice });
    }
  } catch (err) {
    console.error("Invoice update error:", err);
    return NextResponse.json({ error: "Erro ao atualizar nota fiscal" }, { status: 500 });
  }
}
