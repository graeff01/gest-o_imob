import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/server/api-response";
import { auditEvent } from "@/server/audit";
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
    const [rules, bankAccounts] = await Promise.all([
      prisma.bankClassificationRule.findMany({
        include: { category: true, scope_bank_account: true },
        orderBy: [{ is_active: "desc" }, { priority: "asc" }, { use_count: "desc" }, { updated_at: "desc" }],
      }),
      prisma.bankAccount.findMany({
        where: { is_active: true },
        select: { id: true, bank_name: true, account_number: true, account_type: true },
        orderBy: [{ bank_name: "asc" }, { account_number: "asc" }],
      }),
    ]);

    const categories = await prisma.expenseCategory.findMany({
      where: { is_active: true },
      select: { id: true, name: true, department: true },
      orderBy: [{ parent_id: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ rules, categories, bankAccounts });
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
    const scopeBankAccountId = body.scopeBankAccountId ? String(body.scopeBankAccountId) : null;
    const matchMode = ["CONTAINS", "STARTS_WITH", "ENDS_WITH", "EXACT"].includes(String(body.matchMode ?? ""))
      ? String(body.matchMode)
      : "CONTAINS";
    const priority = Number(body.priority ?? 100);
    const amountMin = body.amountMin === null || body.amountMin === undefined || body.amountMin === "" ? null : Number(body.amountMin);
    const amountMax = body.amountMax === null || body.amountMax === undefined || body.amountMax === "" ? null : Number(body.amountMax);

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
        priority,
        scope_bank_account_id: scopeBankAccountId,
        match_mode: matchMode,
        amount_min: amountMin,
        amount_max: amountMax,
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
        priority,
        scope_bank_account_id: scopeBankAccountId,
        match_mode: matchMode,
        amount_min: amountMin,
        amount_max: amountMax,
        confidence: Number(body.confidence ?? 100),
        created_by: userId,
        is_active: body.isActive ?? true,
      },
    });

    await auditEvent({
      action: "bank.rule.saved",
      actorId: userId,
      entityType: "bank_classification_rule",
      entityId: rule.id,
      entityLabel: rule.pattern,
      summary: "Regra de classificacao bancaria salva.",
      metadata: {
        kind,
        priority,
        scopeBankAccountId,
        matchMode,
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("[extratos/regras] create error:", error);
    return NextResponse.json({ error: "Erro ao salvar regra." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  let authContext;
  try {
    authContext = await requireElevatedRole();
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
        ...(body.priority !== undefined ? { priority: Number(body.priority) } : {}),
        ...(body.scopeBankAccountId !== undefined ? { scope_bank_account_id: body.scopeBankAccountId ? String(body.scopeBankAccountId) : null } : {}),
        ...(body.matchMode !== undefined ? { match_mode: String(body.matchMode || "CONTAINS") } : {}),
        ...(body.amountMin !== undefined ? { amount_min: body.amountMin === "" || body.amountMin === null ? null : Number(body.amountMin) } : {}),
        ...(body.amountMax !== undefined ? { amount_max: body.amountMax === "" || body.amountMax === null ? null : Number(body.amountMax) } : {}),
        ...(body.confidence !== undefined ? { confidence: Number(body.confidence) } : {}),
        ...(body.isActive !== undefined ? { is_active: Boolean(body.isActive) } : {}),
      },
    });

    await auditEvent({
      action: "bank.rule.updated",
      actorId: authContext.dbUserId,
      actorEmail: authContext.email,
      entityType: "bank_classification_rule",
      entityId: rule.id,
      entityLabel: rule.pattern,
      summary: "Regra de classificacao bancaria atualizada.",
      metadata: {
        priority: body.priority,
        isActive: body.isActive,
        scopeBankAccountId: body.scopeBankAccountId,
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("[extratos/regras] update error:", error);
    return NextResponse.json({ error: "Erro ao atualizar regra." }, { status: 500 });
  }
}
