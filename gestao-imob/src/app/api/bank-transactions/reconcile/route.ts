import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/server/api-response";
import { requireElevatedRole } from "@/server/authz";
import { ensureBankImportSchema } from "@/server/bank-import-schema";
import { reconcileBankTransaction, unreconcileBankTransaction } from "@/server/bank-operations-service";

export async function POST(request: NextRequest) {
  let authContext;
  try {
    await ensureBankImportSchema();
    authContext = await requireElevatedRole();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const body = await request.json();
    const transactionId = String(body.transactionId ?? "");
    const reconcileType = body.reconcileType as "REVENUE" | "EXPENSE" | "ADVANCE" | "ROYALTY" | undefined;

    if (!transactionId || !reconcileType) {
      return NextResponse.json({ error: "Campos obrigatorios: transactionId, reconcileType" }, { status: 400 });
    }

    const transaction = await reconcileBankTransaction({
      transactionId,
      reconcileType,
      reconcileWithId: body.reconcileWithId ? String(body.reconcileWithId) : null,
      userId: authContext.dbUserId,
      actorEmail: authContext.email,
      reason: body.reason ? String(body.reason) : null,
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error("[bank-transactions/reconcile] POST error:", error);
    return NextResponse.json({ error: "Erro ao conciliar transacao." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  let authContext;
  try {
    await ensureBankImportSchema();
    authContext = await requireElevatedRole();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const body = await request.json();
    const transactionId = String(body.transactionId ?? "");
    if (!transactionId) {
      return NextResponse.json({ error: "Campo obrigatorio: transactionId" }, { status: 400 });
    }

    const transaction = await unreconcileBankTransaction({
      transactionId,
      userId: authContext.dbUserId,
      actorEmail: authContext.email,
      reason: body.reason ? String(body.reason) : null,
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error("[bank-transactions/reconcile] DELETE error:", error);
    return NextResponse.json({ error: "Erro ao desfazer conciliacao." }, { status: 500 });
  }
}
