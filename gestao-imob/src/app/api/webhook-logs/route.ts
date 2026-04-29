import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireElevatedRole } from "@/server/authz";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    await requireElevatedRole();

    const url = new URL(req.url);
    const limit     = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
    const invoiceId = url.searchParams.get("invoice_id");

    const where: Record<string, unknown> = { provider: "nfeio" };
    if (invoiceId) where.invoice_id = invoiceId;

    const logs = await prisma.webhookLog.findMany({
      where,
      orderBy: { received_at: "desc" },
      take: limit,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Webhook logs list error:", error);
    return NextResponse.json({ error: "Erro ao listar logs." }, { status: 500 });
  }
}
