import { createClientSchema } from "@/lib/validations/pessoas";
import { apiCreated, apiList, handleApiError } from "@/server/api-response";
import { requireAuth, requireElevatedRole } from "@/server/authz";
import { createClient, listClients } from "@/server/people-service";

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const result = await listClients({
      search: searchParams.get("search") || "",
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "20", 10),
    });

    return apiList("clients", result.clients, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    return handleApiError(error, "Erro ao listar clientes.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireElevatedRole();
    const input = createClientSchema.parse(await request.json());
    const client = await createClient(input, ctx);
    return apiCreated({ client });
  } catch (error) {
    return handleApiError(error, "Erro ao cadastrar cliente.");
  }
}
