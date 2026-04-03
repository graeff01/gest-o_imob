import { z } from "zod/v4";

export const createContractSchema = z.object({
  property_id: z.string().min(1, "Imovel obrigatorio"),
  client_id: z.string().min(1, "Cliente obrigatorio"),
  consultant_id: z.string().optional(),
  captador_id: z.string().optional(),
  contract_type: z.enum(["LOCACAO", "VENDA"]),
  start_date: z.string().min(1, "Data inicio obrigatoria"),
  end_date: z.string().optional(),
  rent_value: z.string().optional(),
  sale_value: z.string().optional(),
  intermediation_value: z.string().optional(),
  agency_value: z.string().optional(),
  admin_fee_percentage: z.string().optional(),
  guarantee_type: z.enum(["CAUCAO", "FIADOR", "SEGURO_FIANCA", "TITULO_CAPITALIZACAO", "NENHUMA"]).optional(),
  notes: z.string().optional(),
});

export const createExpenseSchema = z.object({
  category_id: z.string().min(1, "Categoria obrigatoria"),
  description: z.string().min(3, "Descricao obrigatoria"),
  amount: z.string().min(1, "Valor obrigatorio"),
  date: z.string().min(1, "Data obrigatoria"),
  due_date: z.string().optional(),
  department: z.enum(["VENDA", "LOCACAO", "ADMIN"]),
  payment_method: z.enum(["PIX", "BOLETO", "CARTAO", "DINHEIRO", "DEBITO_AUTOMATICO", "TRANSFERENCIA"]).optional(),
  status: z.enum(["PENDENTE", "PAGO", "VENCIDO", "CANCELADO"]).default("PENDENTE"),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

export const createRevenueSchema = z.object({
  contract_id: z.string().optional(),
  category: z.enum(["INTERMEDIACAO", "AGENCIAMENTO", "CAMPANHA_SUCESSO", "CAMPANHA_CAPTACAO", "NFSE_ALUGUEL", "ROYALTY", "OUTRO"]),
  description: z.string().min(3, "Descricao obrigatoria"),
  amount: z.string().min(1, "Valor obrigatorio"),
  date: z.string().min(1, "Data obrigatoria"),
  department: z.enum(["VENDA", "LOCACAO", "ADMIN", "AMBOS"]),
  notes: z.string().optional(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateRevenueInput = z.infer<typeof createRevenueSchema>;
