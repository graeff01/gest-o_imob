import { createPropertyOwnerSchema } from "@/lib/validations/pessoas";
import { apiCreated, apiList, handleApiError } from "@/server/api-response";
import { requireAuth, requireElevatedRole } from "@/server/authz";
import { createPropertyOwner, listPropertyOwners } from "@/server/people-service";

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const result = await listPropertyOwners({
      search: searchParams.get("search") || "",
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "20", 10),
    });

    return apiList("owners", result.owners, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    return handleApiError(error, "Erro ao listar proprietarios.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireElevatedRole();
    const input = createPropertyOwnerSchema.parse(await request.json());
    const owner = await createPropertyOwner(input, ctx);
    return apiCreated({ owner });
  } catch (error) {
    return handleApiError(error, "Erro ao cadastrar proprietario.");
  }
}
