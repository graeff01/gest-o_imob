import { z } from "zod";
import { validateCNPJ, validateCPF } from "@/lib/utils";

export const invoiceStatuses = [
  "PENDENTE",
  "PROCESSANDO",
  "EMITIDA",
  "ENVIADA",
  "PAGA",
  "CANCELADA",
  "ERRO",
] as const;

export const invoiceServiceTypes = [
  "INTERMEDIACAO",
  "AGENCIAMENTO",
  "ADMINISTRACAO",
] as const;

const cpfCnpjSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length === 11 || value.length === 14, {
    message: "CPF/CNPJ deve ter 11 ou 14 digitos.",
  })
  .refine((value) => (value.length === 11 ? validateCPF(value) : validateCNPJ(value)), {
    message: "CPF/CNPJ invalido.",
  });

const moneySchema = z.coerce
  .number()
  .finite()
  .positive("Valor deve ser maior que zero.")
  .transform((value) => Math.round(value * 100) / 100);

const nullableText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

export const createInvoiceSchema = z.object({
  contract_id: nullableText,
  reference_year: z.coerce
    .number()
    .int()
    .min(2020)
    .max(2100)
    .default(() => new Date().getFullYear()),
  reference_month: z.coerce.number().int().min(1).max(12).nullable().optional(),
  property_code: nullableText,
  property_address: nullableText,
  client_name: z.string().trim().min(2),
  client_cpf_cnpj: cpfCnpjSchema,
  client_contact: nullableText,
  service_type: z.enum(invoiceServiceTypes),
  title_number: nullableText,
  due_date: z.coerce.date().nullable().optional(),
  amount: moneySchema,
  description_title: z.string().trim().min(3),
  description_body: z.string().trim().min(5),
  notes: nullableText,
});

export const invoiceFiltersSchema = z.object({
  status: z.enum(invoiceStatuses).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  service_type: z.enum(invoiceServiceTypes).optional(),
});

export const updateInvoiceSchema = z.object({
  status: z.enum(invoiceStatuses).optional(),
  sent_at: z.coerce.date().nullable().optional(),
  paid_at: z.coerce.date().nullable().optional(),
  cancelled_at: z.coerce.date().nullable().optional(),
  notes: nullableText,
}).refine((value) => value.status !== "CANCELADA" || !!value.notes, {
  message: "Informe um motivo para cancelar a nota.",
  path: ["notes"],
});

export const emitInvoiceSchema = z.object({
  cep: z
    .string()
    .optional()
    .transform((value) => (value ? value.replace(/\D/g, "") : undefined))
    .refine((value) => !value || value.length === 8, {
      message: "CEP deve ter 8 digitos.",
    }),
  aliquota: z.coerce.number().min(0).max(100).optional(),
  confirmDuplicate: z.boolean().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
