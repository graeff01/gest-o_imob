import { createExpenseSchema } from "@/lib/validations/financeiro";
import { apiCreated, apiSuccess, handleApiError } from "@/server/api-response";
import { requireAuth, requireElevatedRole } from "@/server/authz";
import { createExpense, listExpenses } from "@/server/financial-service";

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const result = await listExpenses({
      month: searchParams.get("month"),
      year: searchParams.get("year"),
      category_id: searchParams.get("category_id"),
      status: searchParams.get("status"),
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "50", 10),
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Erro ao listar despesas.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireElevatedRole();
    const input = createExpenseSchema.parse(await request.json());
    const expense = await createExpense(input, ctx);
    return apiCreated({ expense });
  } catch (error) {
    return handleApiError(error, "Erro ao cadastrar despesa.");
  }
}
