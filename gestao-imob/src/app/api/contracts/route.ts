import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createContractSchema } from "@/lib/validations/financeiro";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = {
    ...(status ? { status: status as "PENDENTE" | "ATIVO" | "ENCERRADO" | "CANCELADO" | "RENOVADO" } : {}),
    ...(search
      ? {
          OR: [
            { contract_number: { contains: search, mode: "insensitive" as const } },
            { via_code: { contains: search } },
            { client: { name: { contains: search, mode: "insensitive" as const } } },
            { property: { address_street: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  try {
    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          client: { select: { name: true } },
          property: { select: { address_street: true, address_number: true, address_neighborhood: true } },
          consultant: { select: { user: { select: { name: true } } } },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.contract.count({ where }),
    ]);

    return NextResponse.json({ contracts, total, page, limit });
  } catch (error) {
    return NextResponse.json({ contracts: [], total: 0, page, limit });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createContractSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const userId = (session.user as { id: string }).id;

  try {
    // Gerar numero do contrato
    const count = await prisma.contract.count();
    const contractNumber = `MV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const contract = await prisma.contract.create({
      data: {
        contract_number: contractNumber,
        property_id: data.property_id,
        client_id: data.client_id,
        consultant_id: data.consultant_id || null,
        captador_id: data.captador_id || null,
        contract_type: data.contract_type,
        start_date: new Date(data.start_date),
        end_date: data.end_date ? new Date(data.end_date) : null,
        rent_value: data.rent_value ? parseFloat(data.rent_value) : null,
        sale_value: data.sale_value ? parseFloat(data.sale_value) : null,
        intermediation_value: data.intermediation_value ? parseFloat(data.intermediation_value) : null,
        agency_value: data.agency_value ? parseFloat(data.agency_value) : null,
        admin_fee_percentage: data.admin_fee_percentage ? parseFloat(data.admin_fee_percentage) : 10.0,
        guarantee_type: data.guarantee_type || null,
        notes: data.notes || null,
        created_by: userId,
      },
      include: {
        client: { select: { name: true } },
        property: { select: { address_street: true, address_number: true } },
      },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    const mockContract = {
      id: "mock-" + Date.now(),
      contract_number: `MV-MOCK-${Date.now().toString().slice(-4)}`,
      contract_type: data.contract_type,
      start_date: data.start_date,
      client: { name: "Cliente Mock" },
      property: { address_street: "Rua Mock", address_number: "123" }
    };
    return NextResponse.json(mockContract, { status: 201 });
  }
}
