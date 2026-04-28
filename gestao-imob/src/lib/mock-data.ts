/**
 * mock-data.ts
 * ------------
 * Arrays de fallback usados pelos API routes quando o banco não está conectado.
 * Quando o PostgreSQL estiver online, os API routes retornam dados reais
 * e este arquivo é ignorado.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_EMPLOYEES: any[] = [
  { id: "emp-001", cpf: "12345678901", position: "CONSULTOR", department: "LOCACAO", contract_type: "CLT", is_active: true, user: { name: "Lucas Rodrigues", email: "lucas.rodrigues@jardimimob.com.br" } },
  { id: "emp-002", cpf: "23456789012", position: "CONSULTOR", department: "VENDA", contract_type: "CLT", is_active: true, user: { name: "Thiago Lima", email: "thiago.lima@jardimimob.com.br" } },
  { id: "emp-003", cpf: "34567890123", position: "CAPTADOR", department: "LOCACAO", contract_type: "CONTRACT", is_active: true, user: { name: "Fernanda Souza", email: "fernanda.souza@jardimimob.com.br" } },
  { id: "emp-004", cpf: "45678901234", position: "RECEPCAO", department: "ADMIN", contract_type: "CLT", is_active: true, user: { name: "Ana Paula Müller", email: "ana.muller@jardimimob.com.br" } },
  { id: "emp-005", cpf: "56789012345", position: "CONSULTOR", department: "LOCACAO", contract_type: "CLT", is_active: true, user: { name: "Roberto Costa", email: "roberto.costa@jardimimob.com.br" } },
  { id: "emp-006", cpf: "67890123456", position: "GERENTE", department: "ADMIN", contract_type: "CLT", is_active: true, user: { name: "Carla Mendonça", email: "carla.mendonca@jardimimob.com.br" } },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_OWNERS: any[] = [
  { id: "own-001", name: "Maria Aparecida Lima", cpf_cnpj: "98765432100", person_type: "PF", phone: "(51) 99234-5678", email: "maria.lima@gmail.com" },
  { id: "own-002", name: "Carlos Eduardo Souza", cpf_cnpj: "11122233344", person_type: "PF", phone: "(51) 98123-4567", email: "carlos.souza@outlook.com" },
  { id: "own-003", name: "Roberto Almeida Costa", cpf_cnpj: "44433322211", person_type: "PF", phone: "(51) 99345-6789", email: "roberto.costa@gmail.com" },
  { id: "own-004", name: "Lucia Hoffmann", cpf_cnpj: "21221212212", person_type: "PF", phone: "(51) 98456-7890", email: "lucia.hoffmann@terra.com.br" },
  { id: "own-005", name: "Imobiliária Planalto Ltda", cpf_cnpj: "89012345000167", person_type: "PJ", phone: "(51) 3232-1234", email: "contato@planalto.imob.br" },
  { id: "own-006", name: "Francisco Antônio Moreira", cpf_cnpj: "55544433322", person_type: "PF", phone: "(51) 99567-8901", email: null },
  { id: "own-007", name: "Construtora Horizonte S.A.", cpf_cnpj: "56789012000134", person_type: "PJ", phone: "(51) 3456-7890", email: "nf@construtora-horizonte.com.br" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_CLIENTS: any[] = [
  { id: "cli-001", name: "João Carlos Mendes", cpf_cnpj: "12345678900", person_type: "PF", phone: "(51) 99111-2233", email: "joao.mendes@gmail.com" },
  { id: "cli-002", name: "Empresa XYZ Ltda", cpf_cnpj: "12345678000190", person_type: "PJ", phone: "(51) 3111-2222", email: "financeiro@empresaxyz.com.br" },
  { id: "cli-003", name: "Ana Paula Ferreira", cpf_cnpj: "55566677788", person_type: "PF", phone: "(51) 98222-3344", email: "ana.ferreira@gmail.com" },
  { id: "cli-004", name: "Construtora Delta S.A.", cpf_cnpj: "98765432000110", person_type: "PJ", phone: "(51) 3333-4444", email: "adm@construtora-delta.com.br" },
  { id: "cli-005", name: "Fernando Henrique Dias", cpf_cnpj: "77788899900", person_type: "PF", phone: "(51) 99333-4455", email: "fernando.dias@hotmail.com" },
  { id: "cli-006", name: "Mariana Costa", cpf_cnpj: "33322211100", person_type: "PF", phone: "(51) 98444-5566", email: "mariana.costa@gmail.com" },
  { id: "cli-007", name: "Pedro Henrique Lemos", cpf_cnpj: "66655544433", person_type: "PF", phone: "(51) 99555-6677", email: "pedro.lemos@gmail.com" },
  { id: "cli-008", name: "Tech Solutions Ltda", cpf_cnpj: "45678901000123", person_type: "PJ", phone: "(51) 3222-3333", email: "contato@techsolutions.com.br" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_PROPERTIES: any[] = [
  { id: "prop-001", via_code: "JL-1200", address_street: "Av. Victor Barreto", address_number: "1200", address_complement: "Ap 301", address_neighborhood: "Jardim do Lago", property_type: "APARTAMENTO", status: "LOCADO", rent_value: "4000", sale_value: null, owner: { name: "Maria Aparecida Lima" } },
  { id: "prop-002", via_code: "JL-0302", address_street: "Rua Guilherme Schell", address_number: "302", address_complement: "Sala 5", address_neighborhood: "Jardim do Lago", property_type: "SALA", status: "DISPONIVEL", rent_value: "6000", sale_value: null, owner: { name: "Carlos Eduardo Souza" } },
  { id: "prop-003", via_code: "JL-0555", address_street: "Av. Inconfidência", address_number: "555", address_complement: "Ap 12", address_neighborhood: "Jardim do Lago", property_type: "APARTAMENTO", status: "LOCADO", rent_value: "3000", sale_value: null, owner: { name: "Roberto Almeida Costa" } },
  { id: "prop-004", via_code: "JL-0077", address_street: "Rua Marechal Floriano", address_number: "77", address_complement: "Cobertura", address_neighborhood: "Jardim do Lago", property_type: "APARTAMENTO", status: "LOCADO", rent_value: "10000", sale_value: null, owner: { name: "Lucia Hoffmann" } },
  { id: "prop-005", via_code: "MV-0820", address_street: "R. Ramiro Barcelos", address_number: "820", address_complement: "Ap 401", address_neighborhood: "Rio Branco", property_type: "APARTAMENTO", status: "LOCADO", rent_value: "3600", sale_value: null, owner: { name: "Francisco Antônio Moreira" } },
  { id: "prop-006", via_code: "MV-0450", address_street: "Av. Carlos Gomes", address_number: "450", address_complement: "Ap 802", address_neighborhood: "Auxiliadora", property_type: "APARTAMENTO", status: "DISPONIVEL", rent_value: "5500", sale_value: null, owner: { name: "Imobiliária Planalto Ltda" } },
  { id: "prop-007", via_code: "MV-3000", address_street: "Av. Protásio Alves", address_number: "3000", address_complement: "Sala 203", address_neighborhood: "Petrópolis", property_type: "SALA", status: "LOCADO", rent_value: "4200", sale_value: null, owner: { name: "Carlos Eduardo Souza" } },
  { id: "prop-008", via_code: "MV-0150", address_street: "Rua Marquês do Herval", address_number: "150", address_complement: "Ap 1502", address_neighborhood: "Centro Histórico", property_type: "APARTAMENTO", status: "DISPONIVEL", rent_value: "2800", sale_value: null, owner: { name: "Roberto Almeida Costa" } },
  { id: "prop-009", via_code: "MV-1500", address_street: "Av. Nilo Peçanha", address_number: "1500", address_complement: "Lote 15", address_neighborhood: "Três Figueiras", property_type: "TERRENO", status: "VENDIDO", rent_value: null, sale_value: "850000", owner: { name: "Construtora Horizonte S.A." } },
  { id: "prop-010", via_code: "JL-0078", address_street: "Rua São Borja", address_number: "78", address_complement: null, address_neighborhood: "Jardim do Lago", property_type: "CASA", status: "DISPONIVEL", rent_value: "8500", sale_value: null, owner: { name: "Lucia Hoffmann" } },
  { id: "prop-011", via_code: "MV-0800", address_street: "Rua Félix da Cunha", address_number: "800", address_complement: "Ap 801", address_neighborhood: "Floresta", property_type: "APARTAMENTO", status: "LOCADO", rent_value: "1950", sale_value: null, owner: { name: "Francisco Antônio Moreira" } },
  { id: "prop-012", via_code: "MV-0320", address_street: "Rua Dona Laura", address_number: "320", address_complement: "Ap 302", address_neighborhood: "Rio Branco", property_type: "APARTAMENTO", status: "LOCADO", rent_value: "3150", sale_value: null, owner: { name: "Imobiliária Planalto Ltda" } },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_CAMPAIGNS: any[] = [
  { id: "camp-001", name: "Campanha Sucesso Locação — Abril 2026", campaign_type: "SUCESSO_LOCACAO", start_date: "2026-04-01", end_date: "2026-04-30", reward_type: "FIXO", reward_amount: "100", status: "ATIVA" },
  { id: "camp-002", name: "Captação Imóveis Premium — Jardim do Lago", campaign_type: "CAPTACAO", start_date: "2026-03-01", end_date: null, reward_type: "FIXO", reward_amount: "50", status: "ATIVA" },
  { id: "camp-003", name: "Locação Semestral 1S/2026", campaign_type: "LOCACAO_SEMESTRAL", start_date: "2026-01-01", end_date: "2026-06-30", reward_type: "FIXO", reward_amount: "200", status: "ATIVA" },
  { id: "camp-004", name: "Campanha Sucesso Locação — Março 2026", campaign_type: "SUCESSO_LOCACAO", start_date: "2026-03-01", end_date: "2026-03-31", reward_type: "FIXO", reward_amount: "100", status: "ENCERRADA" },
];

// Dados financeiros mensais — usados no dashboard
export const MOCK_FINANCIAL_MONTHLY: { mes: string; receita: number; despesa: number; lucro: number }[] = [
  { mes: "Nov/25", receita: 38200, despesa: 24100, lucro: 14100 },
  { mes: "Dez/25", receita: 41500, despesa: 26800, lucro: 14700 },
  { mes: "Jan/26", receita: 43800, despesa: 28200, lucro: 15600 },
  { mes: "Fev/26", receita: 39600, despesa: 25400, lucro: 14200 },
  { mes: "Mar/26", receita: 52300, despesa: 31100, lucro: 21200 },
  { mes: "Abr/26", receita: 47040, despesa: 29800, lucro: 17240 },
];

export const MOCK_EXPENSE_CATEGORIES_PIE: { name: string; value: number; color: string }[] = [
  { name: "Folha/Comissões", value: 18200, color: "#3b82f6" },
  { name: "Royalties Franquia", value: 4700, color: "#8b5cf6" },
  { name: "Marketing", value: 2400, color: "#f59e0b" },
  { name: "Contas de Consumo", value: 1800, color: "#10b981" },
  { name: "Manutenção", value: 1600, color: "#ef4444" },
  { name: "Outros", value: 1100, color: "#6b7280" },
];

export const MOCK_REVENUE_BY_TYPE: { name: string; value: number; color: string }[] = [
  { name: "Intermediação", value: 28400, color: "#3b82f6" },
  { name: "Agenciamento", value: 14200, color: "#10b981" },
  { name: "NFSe Aluguel", value: 4440, color: "#8b5cf6" },
];
