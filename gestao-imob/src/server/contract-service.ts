import { prisma } from "@/lib/prisma";
import type { CreateContractInput } from "@/lib/validations/financeiro";
import type { AuthContext } from "@/server/authz";
import { auditCrud } from "@/server/crud-audit";
import { canUseMockFallback } from "@/server/mock-policy";

interface ListContractsFilters {
  search?: string;
  status?: string;
  page: number;
  limit: number;
}

export async function listContracts(filters: ListContractsFilters) {
  const { search = "", status = "", page, limit } = filters;
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

    if (contracts.length === 0 && total === 0 && canUseMockFallback()) {
      return { contracts: [], total: 0, page, limit };
    }

    return { contracts, total, page, limit };
  } catch (error) {
    if (canUseMockFallback()) {
      return { contracts: [], total: 0, page, limit };
    }
    throw error;
  }
}

export async function createContract(input: CreateContractInput, ctx: AuthContext) {
  const count = await prisma.contract.count();
  const contractNumber = `MV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  const contract = await prisma.contract.create({
    data: {
      contract_number: contractNumber,
      property_id: input.property_id,
      client_id: input.client_id,
      consultant_id: input.consultant_id || null,
      captador_id: input.captador_id || null,
      contract_type: input.contract_type,
      start_date: new Date(input.start_date),
      end_date: input.end_date ? new Date(input.end_date) : null,
      rent_value: input.rent_value ? parseFloat(input.rent_value) : null,
      sale_value: input.sale_value ? parseFloat(input.sale_value) : null,
      intermediation_value: input.intermediation_value ? parseFloat(input.intermediation_value) : null,
      agency_value: input.agency_value ? parseFloat(input.agency_value) : null,
      admin_fee_percentage: input.admin_fee_percentage ? parseFloat(input.admin_fee_percentage) : 10.0,
      guarantee_type: input.guarantee_type || null,
      notes: input.notes || null,
      created_by: ctx.dbUserId,
    },
    include: {
      client: { select: { name: true } },
      property: { select: { address_street: true, address_number: true } },
    },
  });

  await auditCrud({
    ctx,
    entityType: "contract",
    entityId: contract.id,
    entityLabel: contract.contract_number,
    action: "created",
    summary: `Contrato ${contract.contract_number} cadastrado.`,
    metadata: { contract_type: contract.contract_type, client: contract.client.name },
  });

  return contract;
}
