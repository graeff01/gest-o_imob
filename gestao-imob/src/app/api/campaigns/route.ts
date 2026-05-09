import { createCampaignSchema } from "@/lib/validations/operacional";
import { apiCreated, apiSuccess, handleApiError } from "@/server/api-response";
import { requireAuth, requireElevatedRole } from "@/server/authz";
import { createCampaign, listCampaigns } from "@/server/operations-service";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const result = await listCampaigns(searchParams.get("status") || undefined);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Erro ao listar campanhas.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireElevatedRole();
    const input = createCampaignSchema.parse(await request.json());
    const campaign = await createCampaign(input, ctx);
    return apiCreated({ campaign });
  } catch (error) {
    return handleApiError(error, "Erro ao cadastrar campanha.");
  }
}
