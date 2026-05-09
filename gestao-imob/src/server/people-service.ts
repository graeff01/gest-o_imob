import { prisma } from "@/lib/prisma";
import type { CreateClientInput, CreatePropertyOwnerInput } from "@/lib/validations/pessoas";
import type { AuthContext } from "@/server/authz";
import { ApiRouteError } from "@/server/api-response";
import { auditCrud } from "@/server/crud-audit";
import { canUseMockFallback } from "@/server/mock-policy";

interface ListPeopleFilters {
  search?: string;
  page: number;
  limit: number;
}

export async function listClients(filters: ListPeopleFilters) {
  const { search = "", page, limit } = filters;
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
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    if (clients.length === 0 && total === 0 && canUseMockFallback()) {
      const { MOCK_CLIENTS } = await import("@/lib/mock-data");
      const filtered = search
        ? MOCK_CLIENTS.filter((client) =>
            client.name.toLowerCase().includes(search.toLowerCase()) || client.cpf_cnpj.includes(search),
          )
        : MOCK_CLIENTS;

      return {
        clients: filtered.slice(skip, skip + limit),
        total: filtered.length,
        page,
        limit,
      };
    }

    return { clients, total, page, limit };
  } catch (error) {
    if (canUseMockFallback()) {
      const { MOCK_CLIENTS } = await import("@/lib/mock-data");
      const filtered = search
        ? MOCK_CLIENTS.filter((client) =>
            client.name.toLowerCase().includes(search.toLowerCase()) || client.cpf_cnpj.includes(search),
          )
        : MOCK_CLIENTS;

      return {
        clients: filtered.slice(skip, skip + limit),
        total: filtered.length,
        page,
        limit,
      };
    }

    throw error;
  }
}

export async function createClient(input: CreateClientInput, ctx: AuthContext) {
  const existing = await prisma.client.findUnique({
    where: { cpf_cnpj: input.cpf_cnpj },
    select: { id: true },
  });

  if (existing) {
    throw new ApiRouteError("CPF/CNPJ ja cadastrado.", 409, "CLIENT_DUPLICATE");
  }

  const client = await prisma.client.create({ data: input });

  await auditCrud({
    ctx,
    entityType: "client",
    entityId: client.id,
    entityLabel: client.name,
    action: "created",
    summary: `Cliente ${client.name} cadastrado.`,
    metadata: { person_type: client.person_type },
  });

  return client;
}

export async function listPropertyOwners(filters: ListPeopleFilters) {
  const { search = "", page, limit } = filters;
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

    if (owners.length === 0 && total === 0 && canUseMockFallback()) {
      const { MOCK_OWNERS } = await import("@/lib/mock-data");
      const filtered = search
        ? MOCK_OWNERS.filter((owner) =>
            owner.name.toLowerCase().includes(search.toLowerCase()) || owner.cpf_cnpj.includes(search),
          )
        : MOCK_OWNERS;

      return {
        owners: filtered.slice(skip, skip + limit),
        total: filtered.length,
        page,
        limit,
      };
    }

    return { owners, total, page, limit };
  } catch (error) {
    if (canUseMockFallback()) {
      const { MOCK_OWNERS } = await import("@/lib/mock-data");
      const filtered = search
        ? MOCK_OWNERS.filter((owner) =>
            owner.name.toLowerCase().includes(search.toLowerCase()) || owner.cpf_cnpj.includes(search),
          )
        : MOCK_OWNERS;

      return {
        owners: filtered.slice(skip, skip + limit),
        total: filtered.length,
        page,
        limit,
      };
    }

    throw error;
  }
}

export async function createPropertyOwner(input: CreatePropertyOwnerInput, ctx: AuthContext) {
  const existing = await prisma.propertyOwner.findUnique({
    where: { cpf_cnpj: input.cpf_cnpj },
    select: { id: true },
  });

  if (existing) {
    throw new ApiRouteError("CPF/CNPJ ja cadastrado.", 409, "OWNER_DUPLICATE");
  }

  const owner = await prisma.propertyOwner.create({ data: input });

  await auditCrud({
    ctx,
    entityType: "property_owner",
    entityId: owner.id,
    entityLabel: owner.name,
    action: "created",
    summary: `Proprietario ${owner.name} cadastrado.`,
    metadata: { person_type: owner.person_type },
  });

  return owner;
}
