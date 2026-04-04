import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, reconcileType, reconcileWithId } = body;

    if (!transactionId || !reconcileType) {
      return NextResponse.json({ error: "Campos obrigatórios: transactionId, reconcileType" }, { status: 400 });
    }

    const transaction = await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: {
        is_reconciled: true,
        reconciled_with_type: reconcileType,
        reconciled_with_id: reconcileWithId || null,
      },
    });

    return NextResponse.json({ success: true, transaction });
  } catch (err) {
    console.error("Reconcile error:", err);
    return NextResponse.json({ error: "Erro ao conciliar transação" }, { status: 500 });
  }
}
