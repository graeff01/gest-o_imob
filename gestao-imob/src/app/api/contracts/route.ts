import { createContractSchema } from "@/lib/validations/financeiro";
import { apiCreated, apiList, handleApiError } from "@/server/api-response";
import { requireAuth, requireElevatedRole } from "@/server/authz";
import { createContract, listContracts } from "@/server/contract-service";

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const result = await listContracts({
      search: searchParams.get("search") || "",
      status: searchParams.get("status") || "",
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "20", 10),
    });

    return apiList("contracts", result.contracts, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    return handleApiError(error, "Erro ao listar contratos.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireElevatedRole();
    const input = createContractSchema.parse(await request.json());
    const contract = await createContract(input, ctx);
    return apiCreated({ contract });
  } catch (error) {
    return handleApiError(error, "Erro ao cadastrar contrato.");
  }
}
