import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPropertySchema } from "@/lib/validations/pessoas";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = {
    is_active: true,
    ...(status ? { status: status as "DISPONIVEL" | "LOCADO" | "VENDIDO" | "INATIVO" } : {}),
    ...(search
      ? {
          OR: [
            { address_street: { contains: search, mode: "insensitive" as const } },
            { via_code: { contains: search } },
            { vista_code: { contains: search } },
            { address_neighborhood: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: { owner: { select: { name: true } } },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.property.count({ where }),
  ]);

  return NextResponse.json({ properties, total, page, limit });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createPropertySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const property = await prisma.property.create({
    data: {
      owner_id: data.owner_id,
      via_code: data.via_code || null,
      vista_code: data.vista_code || null,
      address_street: data.address_street,
      address_number: data.address_number || null,
      address_complement: data.address_complement || null,
      address_neighborhood: data.address_neighborhood,
      address_city: data.address_city || "Porto Alegre",
      address_state: data.address_state || "RS",
      address_cep: data.address_cep || null,
      property_type: data.property_type,
      rent_value: data.rent_value ? parseFloat(data.rent_value) : null,
      sale_value: data.sale_value ? parseFloat(data.sale_value) : null,
      area_m2: data.area_m2 ? parseFloat(data.area_m2) : null,
      bedrooms: data.bedrooms ? parseInt(data.bedrooms) : null,
      parking_spots: data.parking_spots ? parseInt(data.parking_spots) : null,
      notes: data.notes || null,
    },
    include: { owner: { select: { name: true } } },
  });

  return NextResponse.json(property, { status: 201 });
}
