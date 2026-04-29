import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireElevatedRole } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { cancelNfseAtPrefeitura } from "@/lib/utils/nfse-gateway";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireElevatedRole();
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as { reason?: string };
    const reason = (body.reason ?? "").trim();

    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { error: "Informe o motivo do cancelamento (mínimo 5 caracteres)." },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: "Nota não encontrada." }, { status: 404 });
    }

    if (!invoice.gateway_id) {
      return NextResponse.json(
        { error: "Nota nunca foi enviada à prefeitura — use o cancelamento simples." },
        { status: 400 }
      );
    }

    if (invoice.status === "CANCELADA") {
      return NextResponse.json({ error: "Nota já cancelada." }, { status: 400 });
    }

    const result = await cancelNfseAtPrefeitura(invoice.gateway_id, reason);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Falha ao cancelar na prefeitura." },
        { status: 502 }
      );
    }

    // Marca como em processo de cancelamento — webhook confirma quando prefeitura aprovar
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        gateway_status: result.gatewayStatus ?? "cancellation_requested",
        cancel_reason:  reason,
        notes:          [invoice.notes, `Cancelamento solicitado: ${reason}`].filter(Boolean).join("\n"),
      },
    });

    return NextResponse.json({
      invoice: updated,
      message: "Cancelamento solicitado à prefeitura. O status será atualizado quando confirmado.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Cancel prefeitura error:", error);
    return NextResponse.json({ error: "Erro interno ao cancelar." }, { status: 500 });
  }
}
