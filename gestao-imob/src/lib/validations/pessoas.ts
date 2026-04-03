import { z } from "zod/v4";

export const createEmployeeSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.email("Email invalido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  cpf: z.string().length(11, "CPF deve ter 11 digitos"),
  position: z.enum(["CONSULTOR", "CAPTADOR", "GERENTE", "RECEPCAO", "ESTAGIARIO", "MANUTENCAO", "MKT"]),
  department: z.enum(["VENDA", "LOCACAO", "ADMIN"]),
  contract_type: z.enum(["CLT", "CONTRACT"]),
  hire_date: z.string().min(1, "Data de contratacao obrigatoria"),
  base_salary: z.string().optional(),
});

export const createPropertyOwnerSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf_cnpj: z.string().min(11, "CPF/CNPJ invalido"),
  person_type: z.enum(["PF", "PJ"]),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  bank_name: z.string().optional(),
  bank_agency: z.string().optional(),
  bank_account: z.string().optional(),
  bank_pix: z.string().optional(),
  notes: z.string().optional(),
});

export const createClientSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf_cnpj: z.string().min(11, "CPF/CNPJ invalido"),
  person_type: z.enum(["PF", "PJ"]),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const createPropertySchema = z.object({
  owner_id: z.string().min(1, "Proprietario obrigatorio"),
  via_code: z.string().optional(),
  vista_code: z.string().optional(),
  address_street: z.string().min(3, "Rua obrigatoria"),
  address_number: z.string().optional(),
  address_complement: z.string().optional(),
  address_neighborhood: z.string().min(2, "Bairro obrigatorio"),
  address_city: z.string().default("Porto Alegre"),
  address_state: z.string().default("RS"),
  address_cep: z.string().optional(),
  property_type: z.enum(["APARTAMENTO", "CASA", "COMERCIAL", "SALA", "TERRENO", "OUTRO"]),
  rent_value: z.string().optional(),
  sale_value: z.string().optional(),
  area_m2: z.string().optional(),
  bedrooms: z.string().optional(),
  parking_spots: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type CreatePropertyOwnerInput = z.infer<typeof createPropertyOwnerSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
