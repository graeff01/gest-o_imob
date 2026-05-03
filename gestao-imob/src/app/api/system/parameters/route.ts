import { NextResponse } from "next/server";
import { z } from "zod/v4";
import type { InputJsonValue } from "@prisma/client/runtime/client";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/server/api-response";
import { requireTechnicalRole } from "@/server/authz";
import { auditEvent } from "@/server/audit";
import { ensureFoundationSchema } from "@/server/foundation-schema";

const parameterSchema = z.object({
  scope: z.string().min(2).default("global"),
  payload: z.record(z.string(), z.unknown()),
  reason: z.string().min(3).optional(),
});

function asJson(value: unknown): InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as InputJsonValue;
}

export async function GET(request: Request) {
  try {
    await requireTechnicalRole();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") || "global";

  await ensureFoundationSchema();
  const [current, versions] = await Promise.all([
    prisma.systemParameterVersion.findFirst({
      where: { scope, is_active: true },
      orderBy: { version: "desc" },
    }),
    prisma.systemParameterVersion.findMany({
      where: { scope },
      orderBy: { version: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ current, versions });
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireTechnicalRole();
  } catch (error) {
    return authErrorResponse(error);
  }

  const parsed = parameterSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos.", issues: parsed.error.issues }, { status: 400 });
  }

  const { scope, payload, reason } = parsed.data;
  await ensureFoundationSchema();
  const created = await prisma.$transaction(async (tx) => {
    const last = await tx.systemParameterVersion.findFirst({
      where: { scope },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await tx.systemParameterVersion.updateMany({ where: { scope, is_active: true }, data: { is_active: false } });
    return tx.systemParameterVersion.create({
      data: {
        scope,
        version: (last?.version ?? 0) + 1,
        payload: asJson(payload),
        reason: reason ?? null,
        created_by: ctx.dbUserId,
        is_active: true,
      },
    });
  });

  await auditEvent({
    action: "settings.updated",
    actorId: ctx.dbUserId,
    actorEmail: ctx.email,
    actorType: "HUMAN",
    entityType: "system_parameters",
    entityId: created.id,
    entityLabel: scope,
    summary: `Parametros ${scope} atualizados para a versao ${created.version}.`,
    metadata: { scope, version: created.version, reason },
  });

  return NextResponse.json({ parameter: created }, { status: 201 });
}
