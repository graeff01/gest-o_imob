import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/server/api-response";
import { AuthError, requireAuth, requireElevatedRole } from "@/server/authz";
import { ensureBankImportSchema } from "@/server/bank-import-schema";
import { prisma } from "@/lib/prisma";
import { normalizeBankText } from "@/lib/utils/bank-parsers";

export async function GET() {
  try {
    await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    await ensureBankImportSchema();
    const rules = await prisma.bankClassificationRule.findMany({
      include: { category: true },
      orderBy: [{ is_active: "desc" }, { use_count: "desc" }, { updated_at: "desc" }],
    });

    const categories = await prisma.expenseCategory.findMany({
      where: { is_active: true },
      select: { id: true, name: true, department: true },
      orderBy: [{ parent_id: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ rules, categories });
  } catch (error) {
    console.error("[extratos/regras] list error:", error);
    return NextResponse.json({ error: "Erro ao listar regras." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    const ctx = await requireElevatedRole();
    userId = ctx.dbUserId;
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Erro de autenticacao." }, { status: 500 });
  }

  try {
    await ensureBankImportSchema();
    const body = await request.json();
    const pattern = String(body.pattern ?? "").trim();
    const kind = body.kind === "receita" ? "receita" : "despesa";
    const categoryLabel = String(body.categoryLabel ?? "").trim();
    const categoryId = body.categoryId ? String(body.categoryId) : null;

    if (!pattern || !categoryLabel) {
      return NextResponse.json({ error: "Informe padrao e categoria." }, { status: 400 });
    }

    const rule = await prisma.bankClassificationRule.upsert({
      where: {
        normalized_pattern_kind: {
          normalized_pattern: normalizeBankText(pattern),
          kind,
        },
      },
      update: {
        pattern,
        category_id: categoryId,
        category_label: categoryLabel,
        revenue_category: kind === "receita" ? body.revenueCategory ?? "OUTRO" : null,
        department: body.department ?? "AMBOS",
        payment_method: body.paymentMethod || null,
        confidence: Number(body.confidence ?? 100),
        is_active: body.isActive ?? true,
      },
      create: {
        pattern,
        normalized_pattern: normalizeBankText(pattern),
        kind,
        category_id: categoryId,
        category_label: categoryLabel,
        revenue_category: kind === "receita" ? body.revenueCategory ?? "OUTRO" : null,
        department: body.department ?? "AMBOS",
        payment_method: body.paymentMethod || null,
        confidence: Number(body.confidence ?? 100),
        created_by: userId,
        is_active: body.isActive ?? true,
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("[extratos/regras] create error:", error);
    return NextResponse.json({ error: "Erro ao salvar regra." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireElevatedRole();
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Erro de autenticacao." }, { status: 500 });
  }

  try {
    await ensureBankImportSchema();
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "id obrigatorio." }, { status: 400 });

    const rule = await prisma.bankClassificationRule.update({
      where: { id },
      data: {
        ...(body.pattern ? { pattern: String(body.pattern), normalized_pattern: normalizeBankText(String(body.pattern)) } : {}),
        ...(body.categoryId !== undefined ? { category_id: body.categoryId ? String(body.categoryId) : null } : {}),
        ...(body.categoryLabel ? { category_label: String(body.categoryLabel) } : {}),
        ...(body.revenueCategory !== undefined ? { revenue_category: body.revenueCategory || null } : {}),
        ...(body.department ? { department: body.department } : {}),
        ...(body.paymentMethod !== undefined ? { payment_method: body.paymentMethod || null } : {}),
        ...(body.confidence !== undefined ? { confidence: Number(body.confidence) } : {}),
        ...(body.isActive !== undefined ? { is_active: Boolean(body.isActive) } : {}),
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("[extratos/regras] update error:", error);
    return NextResponse.json({ error: "Erro ao atualizar regra." }, { status: 500 });
  }
}
