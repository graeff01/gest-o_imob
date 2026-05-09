import { prisma } from "@/lib/prisma";
import type { CreateCampaignInput, CreateDocumentInput } from "@/lib/validations/operacional";
import type { AuthContext } from "@/server/authz";
import { auditCrud } from "@/server/crud-audit";
import { canUseMockFallback } from "@/server/mock-policy";

export async function listCampaigns(status?: string) {
  const where = status ? { status: status as "ATIVA" | "ENCERRADA" | "CANCELADA" } : {};

  try {
    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    if (campaigns.length === 0 && canUseMockFallback()) {
      const { MOCK_CAMPAIGNS } = await import("@/lib/mock-data");
      return {
        campaigns: status ? MOCK_CAMPAIGNS.filter((campaign) => campaign.status === status) : MOCK_CAMPAIGNS,
      };
    }

    return { campaigns };
  } catch (error) {
    if (canUseMockFallback()) {
      const { MOCK_CAMPAIGNS } = await import("@/lib/mock-data");
      return {
        campaigns: status ? MOCK_CAMPAIGNS.filter((campaign) => campaign.status === status) : MOCK_CAMPAIGNS,
      };
    }
    throw error;
  }
}

export async function createCampaign(input: CreateCampaignInput, ctx: AuthContext) {
  const campaign = await prisma.campaign.create({
    data: {
      name: input.name,
      campaign_type: input.campaign_type,
      start_date: new Date(input.start_date),
      end_date: input.end_date ? new Date(input.end_date) : null,
      reward_type: input.reward_type,
      reward_amount: Number(input.reward_amount),
      description: input.description || null,
      status: input.status || "ATIVA",
      created_by: ctx.dbUserId,
    },
  });

  await auditCrud({
    ctx,
    entityType: "campaign",
    entityId: campaign.id,
    entityLabel: campaign.name,
    action: "created",
    summary: `Campanha ${campaign.name} cadastrada.`,
    metadata: { campaign_type: campaign.campaign_type, reward_type: campaign.reward_type },
  });

  return campaign;
}

interface ListDocumentsFilters {
  type?: string;
  status?: string;
  page: number;
  limit: number;
}

export async function listDocuments(filters: ListDocumentsFilters) {
  const { type = "", status = "", page, limit } = filters;
  const skip = (page - 1) * limit;
  const where = {
    ...(type ? { document_type: type as "NOTA_FISCAL" | "RECIBO" | "EXTRATO_BANCARIO" | "PLANILHA" | "COMPROVANTE" | "CONTRATO" | "OUTRO" } : {}),
    ...(status ? { processing_status: status as "PENDENTE" | "PROCESSANDO" | "PROCESSADO" | "ERRO" } : {}),
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: { uploader: { select: { name: true } } },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.document.count({ where }),
  ]);

  return { documents, total, page, limit };
}

export async function registerDocument(input: CreateDocumentInput, ctx: AuthContext) {
  const document = await prisma.document.create({
    data: {
      filename: input.filename,
      original_filename: input.original_filename,
      mime_type: input.mime_type,
      file_size: input.file_size,
      storage_url: input.storage_url,
      uploaded_by: ctx.dbUserId,
      document_type: input.document_type ?? "OUTRO",
      processing_status: "PENDENTE",
      related_entity_type: input.related_entity_type ?? null,
      related_entity_id: input.related_entity_id ?? null,
    },
  });

  await auditCrud({
    ctx,
    entityType: "document",
    entityId: document.id,
    entityLabel: document.original_filename,
    action: "created",
    summary: `Documento ${document.original_filename} registrado.`,
    metadata: { document_type: document.document_type, related_entity_type: document.related_entity_type },
  });

  return document;
}
