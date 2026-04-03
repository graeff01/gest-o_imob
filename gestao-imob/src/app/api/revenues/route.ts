import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createRevenueSchema } from "@/lib/validations/financeiro";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const now = new Date();
  const refMonth = month ? parseInt(month) : now.getMonth() + 1;
  const refYear = year ? parseInt(year) : now.getFullYear();

  const where = {
    reference_month: refMonth,
    reference_year: refYear,
    ...(category ? { category: category as "INTERMEDIACAO" | "AGENCIAMENTO" | "CAMPANHA_SUCESSO" | "CAMPANHA_CAPTACAO" | "NFSE_ALUGUEL" | "ROYALTY" | "OUTRO" } : {}),
  };

  const [revenues, total, totalAmount] = await Promise.all([
    prisma.revenue.findMany({
      where,
      include: { contract: { select: { contract_number: true } } },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.revenue.count({ where }),
    prisma.revenue.aggregate({ where, _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    revenues,
    total,
    totalAmount: Number(totalAmount._sum.amount || 0),
    page,
    limit,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createRevenueSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const userId = (session.user as { id: string }).id;
  const date = new Date(data.date);

  const revenue = await prisma.revenue.create({
    data: {
      contract_id: data.contract_id || null,
      category: data.category,
      description: data.description,
      amount: parseFloat(data.amount),
      date,
      department: data.department,
      reference_month: date.getMonth() + 1,
      reference_year: date.getFullYear(),
      notes: data.notes || null,
      created_by: userId,
    },
  });

  return NextResponse.json(revenue, { status: 201 });
}
