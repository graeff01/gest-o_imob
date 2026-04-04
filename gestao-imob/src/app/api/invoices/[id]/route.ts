import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const invoice = await prisma.invoice.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ invoice });
  } catch (err) {
    console.error("Invoice update error:", err);
    return NextResponse.json({ error: "Erro ao atualizar nota fiscal" }, { status: 500 });
  }
}
