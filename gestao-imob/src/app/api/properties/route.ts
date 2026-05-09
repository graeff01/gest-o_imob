import { createPropertySchema } from "@/lib/validations/pessoas";
import { apiCreated, apiList, handleApiError } from "@/server/api-response";
import { requireAuth, requireElevatedRole } from "@/server/authz";
import { createProperty, listProperties } from "@/server/property-service";

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const result = await listProperties({
      search: searchParams.get("search") || "",
      status: searchParams.get("status") || "",
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "20", 10),
    });

    return apiList("properties", result.properties, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    return handleApiError(error, "Erro ao listar imoveis.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireElevatedRole();
    const input = createPropertySchema.parse(await request.json());
    const property = await createProperty(input, ctx);
    return apiCreated({ property });
  } catch (error) {
    return handleApiError(error, "Erro ao cadastrar imovel.");
  }
}
