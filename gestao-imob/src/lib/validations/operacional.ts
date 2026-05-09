import { z } from "zod/v4";

export const createCampaignSchema = z.object({
  name: z.string().min(3, "Nome obrigatorio"),
  campaign_type: z.enum(["SUCESSO_LOCACAO", "CAPTACAO", "LOCACAO_SEMESTRAL"]),
  start_date: z.string().min(1, "Data inicial obrigatoria"),
  end_date: z.string().optional(),
  reward_type: z.enum(["FIXO", "PERCENTUAL"]),
  reward_amount: z.union([z.string().min(1), z.number()]),
  description: z.string().optional(),
  status: z.enum(["ATIVA", "ENCERRADA", "CANCELADA"]).optional(),
});

export const createDocumentSchema = z.object({
  filename: z.string().min(3, "Nome do arquivo obrigatorio"),
  original_filename: z.string().min(3, "Nome original obrigatorio"),
  mime_type: z.string().min(3, "Mime type obrigatorio"),
  file_size: z.number().int().positive("Tamanho do arquivo obrigatorio"),
  storage_url: z.string().url("Storage URL invalida"),
  document_type: z.enum(["NOTA_FISCAL", "RECIBO", "EXTRATO_BANCARIO", "PLANILHA", "COMPROVANTE", "CONTRATO", "OUTRO"]).optional(),
  related_entity_type: z.enum(["EXPENSE", "REVENUE", "CONTRACT", "BANK_TRANSACTION"]).optional(),
  related_entity_id: z.string().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
