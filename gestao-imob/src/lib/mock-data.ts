/**
 * Dados demonstrativos ficticios.
 *
 * Estes arrays existem apenas para ambientes locais controlados.
 * Nao representam clientes, pessoas, empresas ou documentos reais.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_EMPLOYEES: any[] = [
  { id: "emp-001", cpf: "00000000000", position: "CONSULTOR", department: "LOCACAO", contract_type: "CLT", is_active: true, user: { name: "Colaborador Exemplo 1", email: "employee1@example.com" } },
  { id: "emp-002", cpf: "00000000000", position: "CONSULTOR", department: "VENDA", contract_type: "CLT", is_active: true, user: { name: "Colaborador Exemplo 2", email: "employee2@example.com" } },
  { id: "emp-003", cpf: "00000000000", position: "CAPTADOR", department: "LOCACAO", contract_type: "CONTRACT", is_active: true, user: { name: "Colaborador Exemplo 3", email: "employee3@example.com" } },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_OWNERS: any[] = [
  { id: "own-001", name: "Proprietario Exemplo 1", cpf_cnpj: "00000000000", person_type: "PF", phone: "(00) 90000-0001", email: "owner1@example.com" },
  { id: "own-002", name: "Proprietario Exemplo 2", cpf_cnpj: "00000000000", person_type: "PF", phone: "(00) 90000-0002", email: "owner2@example.com" },
  { id: "own-003", name: "Empresa Proprietaria Exemplo", cpf_cnpj: "00000000000000", person_type: "PJ", phone: "(00) 3000-0000", email: "owner-company@example.com" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_CLIENTS: any[] = [
  { id: "cli-001", name: "Cliente Exemplo 1", cpf_cnpj: "00000000000", person_type: "PF", phone: "(00) 90000-1001", email: "client1@example.com" },
  { id: "cli-002", name: "Cliente Exemplo 2", cpf_cnpj: "00000000000", person_type: "PF", phone: "(00) 90000-1002", email: "client2@example.com" },
  { id: "cli-003", name: "Empresa Cliente Exemplo", cpf_cnpj: "00000000000000", person_type: "PJ", phone: "(00) 3000-1000", email: "client-company@example.com" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_PROPERTIES: any[] = [
  { id: "prop-001", via_code: "DEMO-001", address_street: "Rua Exemplo", address_number: "100", address_complement: "Ap 101", address_neighborhood: "Centro", property_type: "APARTAMENTO", status: "LOCADO", rent_value: "4000", sale_value: null, owner: { name: "Proprietario Exemplo 1" } },
  { id: "prop-002", via_code: "DEMO-002", address_street: "Avenida Demonstrativa", address_number: "200", address_complement: "Sala 20", address_neighborhood: "Comercial", property_type: "SALA", status: "DISPONIVEL", rent_value: "6000", sale_value: null, owner: { name: "Empresa Proprietaria Exemplo" } },
  { id: "prop-003", via_code: "DEMO-003", address_street: "Rua Modelo", address_number: "300", address_complement: null, address_neighborhood: "Residencial", property_type: "CASA", status: "DISPONIVEL", rent_value: "8500", sale_value: null, owner: { name: "Proprietario Exemplo 2" } },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_CAMPAIGNS: any[] = [
  { id: "camp-001", name: "Campanha Demonstrativa - Locacao", campaign_type: "SUCESSO_LOCACAO", start_date: "2026-04-01", end_date: "2026-04-30", reward_type: "FIXO", reward_amount: "100", status: "ATIVA" },
  { id: "camp-002", name: "Campanha Demonstrativa - Captacao", campaign_type: "CAPTACAO", start_date: "2026-03-01", end_date: null, reward_type: "FIXO", reward_amount: "50", status: "ATIVA" },
];

export const MOCK_FINANCIAL_MONTHLY: { mes: string; receita: number; despesa: number; lucro: number }[] = [
  { mes: "Nov/25", receita: 38200, despesa: 24100, lucro: 14100 },
  { mes: "Dez/25", receita: 41500, despesa: 26800, lucro: 14700 },
  { mes: "Jan/26", receita: 43800, despesa: 28200, lucro: 15600 },
  { mes: "Fev/26", receita: 39600, despesa: 25400, lucro: 14200 },
  { mes: "Mar/26", receita: 52300, despesa: 31100, lucro: 21200 },
  { mes: "Abr/26", receita: 47040, despesa: 29800, lucro: 17240 },
];

export const MOCK_EXPENSE_CATEGORIES_PIE: { name: string; value: number; color: string }[] = [
  { name: "Folha/Comissoes", value: 18200, color: "#3b82f6" },
  { name: "Royalties", value: 4700, color: "#8b5cf6" },
  { name: "Marketing", value: 2400, color: "#f59e0b" },
  { name: "Contas de Consumo", value: 1800, color: "#10b981" },
  { name: "Manutencao", value: 1600, color: "#ef4444" },
  { name: "Outros", value: 1100, color: "#6b7280" },
];

export const MOCK_REVENUE_BY_TYPE: { name: string; value: number; color: string }[] = [
  { name: "Intermediacao", value: 28400, color: "#3b82f6" },
  { name: "Agenciamento", value: 14200, color: "#10b981" },
  { name: "Servicos", value: 4440, color: "#8b5cf6" },
];
