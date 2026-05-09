import { prisma } from "@/lib/prisma";
import type { CreatePropertyInput } from "@/lib/validations/pessoas";
import type { AuthContext } from "@/server/authz";
import { auditCrud } from "@/server/crud-audit";
import { canUseMockFallback } from "@/server/mock-policy";

interface ListPropertiesFilters {
  search?: string;
  status?: string;
  page: number;
  limit: number;
}

export async function listProperties(filters: ListPropertiesFilters) {
  const { search = "", status = "", page, limit } = filters;
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

  try {
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

    if (properties.length === 0 && total === 0 && canUseMockFallback()) {
      const { MOCK_PROPERTIES } = await import("@/lib/mock-data");
      let filtered = MOCK_PROPERTIES;
      if (search) {
        const normalized = search.toLowerCase();
        filtered = filtered.filter(
          (property) =>
            property.address_street.toLowerCase().includes(normalized) ||
            (property.via_code && property.via_code.toLowerCase().includes(normalized)) ||
            property.address_neighborhood.toLowerCase().includes(normalized),
        );
      }
      if (status) {
        filtered = filtered.filter((property) => property.status === status);
      }
      return {
        properties: filtered.slice(skip, skip + limit),
        total: filtered.length,
        page,
        limit,
      };
    }

    return { properties, total, page, limit };
  } catch (error) {
    if (canUseMockFallback()) {
      const { MOCK_PROPERTIES } = await import("@/lib/mock-data");
      return {
        properties: MOCK_PROPERTIES.slice(skip, skip + limit),
        total: MOCK_PROPERTIES.length,
        page,
        limit,
      };
    }

    throw error;
  }
}

export async function createProperty(input: CreatePropertyInput, ctx: AuthContext) {
  const property = await prisma.property.create({
    data: {
      owner_id: input.owner_id,
      via_code: input.via_code || null,
      vista_code: input.vista_code || null,
      address_street: input.address_street,
      address_number: input.address_number || null,
      address_complement: input.address_complement || null,
      address_neighborhood: input.address_neighborhood,
      address_city: input.address_city || "Canoas",
      address_state: input.address_state || "RS",
      address_cep: input.address_cep || null,
      property_type: input.property_type,
      rent_value: input.rent_value ? parseFloat(input.rent_value) : null,
      sale_value: input.sale_value ? parseFloat(input.sale_value) : null,
      area_m2: input.area_m2 ? parseFloat(input.area_m2) : null,
      bedrooms: input.bedrooms ? parseInt(input.bedrooms, 10) : null,
      parking_spots: input.parking_spots ? parseInt(input.parking_spots, 10) : null,
      notes: input.notes || null,
    },
    include: { owner: { select: { name: true } } },
  });

  await auditCrud({
    ctx,
    entityType: "property",
    entityId: property.id,
    entityLabel: `${property.address_street}${property.address_number ? `, ${property.address_number}` : ""}`,
    action: "created",
    summary: `Imovel ${property.address_street} cadastrado.`,
    metadata: { property_type: property.property_type, city: property.address_city },
  });

  return property;
}
