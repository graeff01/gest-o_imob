import { NextResponse } from "next/server";
import { AuthError, requireElevatedRole } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { emitInvoice } from "@/server/invoice-service";

// Erros que vale tentar de novo (transientes)
const RECOVERABLE_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /econnreset/i,
  /econnrefused/i,
  /etimedout/i,
  /network/i,
  /fetch failed/i,
  /\b(502|503|504)\b/,
  /service unavailable/i,
  /bad gateway/i,
  /gateway timeout/i,
];

function isRecoverable(errorMsg: string | null): boolean {
  if (!errorMsg) return false;
  return RECOVERABLE_PATTERNS.some((p) => p.test(errorMsg));
}

export async function POST() {
  try {
    await requireElevatedRole();

    const now = new Date();

    // Busca notas com erro recuperável e que já passaram do retry_after
    const candidates = await prisma.invoice.findMany({
      where: {
        status: "ERRO",
        emit_attempts: { lt: 5 }, // limite de 5 tentativas
        OR: [
          { retry_after: null },
          { retry_after: { lte: now } },
        ],
      },
      select: { id: true, last_emit_error: true, emit_attempts: true },
      take: 20, // processa no máximo 20 por chamada
    });

    const eligible = candidates.filter((c) => isRecoverable(c.last_emit_error));

    const results = {
      total_candidates: candidates.length,
      eligible: eligible.length,
      succeeded: 0,
      failed: 0,
      details: [] as Array<{ id: string; success: boolean; error?: string }>,
    };

    for (const inv of eligible) {
      try {
        const result = await emitInvoice(inv.id, {});
        if ("success" in result && result.success) {
          results.succeeded++;
          results.details.push({ id: inv.id, success: true });
        } else {
          results.failed++;
          const errMsg = "error" in result ? result.error : "falha desconhecida";
          results.details.push({ id: inv.id, success: false, error: errMsg });

          // Backoff exponencial: 5min × 2^tentativas (até 4h)
          const backoffMin = Math.min(5 * Math.pow(2, inv.emit_attempts), 240);
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { retry_after: new Date(Date.now() + backoffMin * 60 * 1000) },
          });
        }
      } catch (err) {
        results.failed++;
        results.details.push({
          id: inv.id,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Retry failed error:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
