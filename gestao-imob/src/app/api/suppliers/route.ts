import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/server/api-response";
import { requireAuth, requireElevatedRole } from "@/server/authz";
import { auditEvent } from "@/server/audit";
import { ensureFoundationSchema } from "@/server/foundation-schema";

const supplierSchema = z.object({
  name: z.string().min(2),
  cpf_cnpj: z.string().optional().nullable(),
  category_id: z.string().optional().nullable(),
  default_category: z.string().optional().nullable(),
  classification_key: z.string().optional().nullable(),
  confidence: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional().nullable(),
});

function normalizeKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function GET(request: Request) {
  try {
    await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  await ensureFoundationSchema();
  const suppliers = await prisma.supplier.findMany({
    where: {
      is_active: true,
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    },
    include: { category: { select: { name: true, code: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });

  return NextResponse.json({ suppliers });
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireElevatedRole();
  } catch (error) {
    return authErrorResponse(error);
  }

  const parsed = supplierSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos.", issues: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;
  await ensureFoundationSchema();
  const supplier = await prisma.supplier.create({
    data: {
      name: data.name,
      cpf_cnpj: data.cpf_cnpj || null,
      category_id: data.category_id || null,
      default_category: data.default_category || null,
      classification_key: data.classification_key || normalizeKey(data.name),
      confidence: data.confidence ?? 100,
      notes: data.notes || null,
    },
  });

  await auditEvent({
    action: "record.created",
    actorId: ctx.dbUserId,
    actorEmail: ctx.email,
    actorType: "HUMAN",
    entityType: "supplier",
    entityId: supplier.id,
    entityLabel: supplier.name,
    summary: `Fornecedor ${supplier.name} criado.`,
  });

  return NextResponse.json({ supplier }, { status: 201 });
}
