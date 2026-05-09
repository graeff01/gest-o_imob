import { createDocumentSchema } from "@/lib/validations/operacional";
import { apiCreated, apiList, handleApiError } from "@/server/api-response";
import { requireAuth, requireElevatedRole } from "@/server/authz";
import { listDocuments, registerDocument } from "@/server/operations-service";

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const result = await listDocuments({
      type: searchParams.get("type") || "",
      status: searchParams.get("status") || "",
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "20", 10),
    });

    return apiList("documents", result.documents, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    return handleApiError(error, "Erro ao listar documentos.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireElevatedRole();
    const input = createDocumentSchema.parse(await request.json());
    const document = await registerDocument(input, ctx);
    return apiCreated({ document });
  } catch (error) {
    return handleApiError(error, "Erro ao registrar documento.");
  }
}
