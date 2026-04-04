import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectAndParse, suggestCategory } from "@/lib/utils/bank-parsers";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bankAccountId = formData.get("bank_account_id") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }
    if (!bankAccountId) {
      return NextResponse.json({ error: "Conta bancária não informada" }, { status: 400 });
    }

    // Verificar se a conta existe
    const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
    if (!account) {
      return NextResponse.json({ error: "Conta bancária não encontrada" }, { status: 404 });
    }

    // Ler conteúdo do arquivo
    const content = await file.text();
    const fileName = file.name;

    // Parse automático
    const result = detectAndParse(content, fileName);

    if (!result.success || result.transactions.length === 0) {
      return NextResponse.json({
        error: "Não foi possível extrair transações do arquivo",
        details: result.errors,
      }, { status: 422 });
    }

    // Buscar categorias para sugestão
    const categories = await prisma.expenseCategory.findMany({
      where: { is_active: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

    // Gerar batch ID
    const batchId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Preparar transações para inserção
    let imported = 0;
    let skipped = 0;
    const importErrors: string[] = [];

    for (const tx of result.transactions) {
      // Sugerir categoria
      const suggestedCatName = suggestCategory(tx.description);
      let categoryId: string | null = null;
      if (suggestedCatName) {
        // Procurar match parcial
        for (const [name, id] of categoryMap) {
          if (name.toLowerCase().includes(suggestedCatName.toLowerCase())) {
            categoryId = id;
            break;
          }
        }
      }

      try {
        await prisma.bankTransaction.create({
          data: {
            bank_account_id: bankAccountId,
            date: new Date(tx.date),
            description: tx.description,
            amount: tx.amount,
            balance: tx.balance ?? null,
            doc_number: tx.docNumber ?? null,
            operation_type: tx.operationType,
            is_credit: tx.isCredit,
            category_id: categoryId,
            import_batch_id: batchId,
            is_reconciled: false,
          },
        });
        imported++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Duplicata (unique constraint)
        if (msg.includes("Unique constraint")) {
          skipped++;
        } else {
          importErrors.push(`${tx.date} ${tx.description}: ${msg}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      bankName: result.bankName,
      accountInfo: result.accountInfo,
      batchId,
      stats: {
        parsed: result.transactions.length,
        imported,
        skipped,
        errors: importErrors.length,
      },
      parseErrors: result.errors,
      importErrors,
    });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json({ error: "Erro interno ao importar extrato" }, { status: 500 });
  }
}
