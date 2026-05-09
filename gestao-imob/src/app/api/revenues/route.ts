import { createRevenueSchema } from "@/lib/validations/financeiro";
import { apiCreated, apiSuccess, handleApiError } from "@/server/api-response";
import { requireAuth, requireElevatedRole } from "@/server/authz";
import { createRevenue, listRevenues } from "@/server/financial-service";

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const result = await listRevenues({
      month: searchParams.get("month"),
      year: searchParams.get("year"),
      category: searchParams.get("category"),
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "50", 10),
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Erro ao listar receitas.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireElevatedRole();
    const input = createRevenueSchema.parse(await request.json());
    const revenue = await createRevenue(input, ctx);
    return apiCreated({ revenue });
  } catch (error) {
    return handleApiError(error, "Erro ao cadastrar receita.");
  }
}
