import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/server/api-response";
import { requireElevatedRole } from "@/server/authz";
import { auditEvent } from "@/server/audit";
import { ensureFoundationSchema } from "@/server/foundation-schema";

const supplierPatchSchema = z.object({
  name: z.string().min(2).optional(),
  cpf_cnpj: z.string().optional().nullable(),
  category_id: z.string().optional().nullable(),
  default_category: z.string().optional().nullable(),
  classification_key: z.string().optional().nullable(),
  confidence: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await requireElevatedRole();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const parsed = supplierPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos.", issues: parsed.error.issues }, { status: 400 });
  }

  await ensureFoundationSchema();
  const supplier = await prisma.supplier.update({
    where: { id },
    data: parsed.data,
  });

  await auditEvent({
    action: "record.updated",
    actorId: ctx.dbUserId,
    actorEmail: ctx.email,
    actorType: "HUMAN",
    entityType: "supplier",
    entityId: supplier.id,
    entityLabel: supplier.name,
    summary: `Fornecedor ${supplier.name} atualizado.`,
    metadata: parsed.data,
  });

  return NextResponse.json({ supplier });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await requireElevatedRole();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  await ensureFoundationSchema();
  const supplier = await prisma.supplier.update({
    where: { id },
    data: { is_active: false },
  });

  await auditEvent({
    action: "record.deleted",
    actorId: ctx.dbUserId,
    actorEmail: ctx.email,
    actorType: "HUMAN",
    entityType: "supplier",
    entityId: supplier.id,
    entityLabel: supplier.name,
    summary: `Fornecedor ${supplier.name} inativado.`,
    severity: "WARN",
  });

  return NextResponse.json({ supplier });
}
