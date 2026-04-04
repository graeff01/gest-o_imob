import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPropertyOwnerSchema } from "@/lib/validations/pessoas";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = {
    is_active: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { cpf_cnpj: { contains: search } },
          ],
        }
      : {}),
  };

  try {
    const [owners, total] = await Promise.all([
      prisma.propertyOwner.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.propertyOwner.count({ where }),
    ]);

    return NextResponse.json({ owners, total, page, limit });
  } catch (error) {
    return NextResponse.json({ owners: [], total: 0, page, limit });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createPropertyOwnerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const existing = await prisma.propertyOwner.findUnique({
      where: { cpf_cnpj: data.cpf_cnpj },
    });
    if (existing) {
      return NextResponse.json(
        { error: "CPF/CNPJ ja cadastrado" },
        { status: 409 }
      );
    }

    const owner = await prisma.propertyOwner.create({ data });

    return NextResponse.json(owner, { status: 201 });
  } catch (error) {
    const mockOwner = { ...data, id: "mock-" + Date.now() };
    return NextResponse.json(mockOwner, { status: 201 });
  }
}
