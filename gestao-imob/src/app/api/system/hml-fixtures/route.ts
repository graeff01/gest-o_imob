import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { authErrorResponse } from "@/server/api-response";
import { requireTechnicalRole } from "@/server/authz";
import { auditEvent } from "@/server/audit";
import { hmlReadinessSnapshot, resetOperationalData, seedHmlData } from "@/server/hml-fixtures";

const actionSchema = z.object({
  action: z.enum(["seed", "reset-and-seed"]),
});

export async function GET() {
  try {
    await requireTechnicalRole();
  } catch (error) {
    return authErrorResponse(error);
  }

  const snapshot = await hmlReadinessSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireTechnicalRole();
  } catch (error) {
    return authErrorResponse(error);
  }

  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Acao invalida.", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    if (parsed.data.action === "reset-and-seed") {
      await resetOperationalData();
      await auditEvent({
        action: "system.hml_reset",
        actorId: ctx.dbUserId,
        actorEmail: ctx.email,
        actorType: "HUMAN",
        entityType: "system",
        entityLabel: "HML fixtures",
        summary: "Dados operacionais de HML resetados para nova validacao.",
        severity: "CRITICAL",
      });
    }

    await seedHmlData(ctx);
    const snapshot = await hmlReadinessSnapshot();
    return NextResponse.json({ ok: true, action: parsed.data.action, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao preparar HML.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
