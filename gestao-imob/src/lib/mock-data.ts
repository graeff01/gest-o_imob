/**
 * DADOS DE DEMONSTRAÇÃO - TEMPORÁRIOS
 *
 * Estes dados simulam o banco de dados enquanto o PostgreSQL/Railway não está conectado.
 * Quando o banco estiver online, os API routes automaticamente retornam dados reais
 * e este arquivo pode ser removido.
 *
 * IMPORTANTE: A estrutura de cada objeto espelha EXATAMENTE o schema Prisma,
 * para que a transição mock → produção seja zero-effort.
 */

// ═══════════════════════════════════════════
// FUNCIONÁRIOS
// ═══════════════════════════════════════════

export const MOCK_EMPLOYEES = [
  {
    id: "emp-001",
    cpf: "02345678901",
    position: "CONSULTOR",
    department: "LOCACAO",
    contract_type: "CLT",
    hire_date: "2024-03-15",
    is_active: true,
    user: { name: "Lucas Rodrigues", email: "lucas@moinhos.com", role: "MANAGER" },
  },
  {
    id: "emp-002",
    cpf: "12345678902",
    position: "CONSULTOR",
    department: "LOCACAO",
    contract_type: "CONTRACT",
    hire_date: "2024-06-01",
    is_active: true,
    user: { name: "Fernanda Oliveira", email: "fernanda@moinhos.com", role: "MANAGER" },
  },
  {
    id: "emp-003",
    cpf: "22345678903",
    position: "CONSULTOR",
    department: "VENDA",
    contract_type: "CLT",
    hire_date: "2025-01-10",
    is_active: true,
    user: { name: "Rafael Souza", email: "rafael@moinhos.com", role: "MANAGER" },
  },
  {
    id: "emp-004",
    cpf: "32345678904",
    position: "CAPTADOR",
    department: "LOCACAO",
    contract_type: "CONTRACT",
    hire_date: "2025-04-01",
    is_active: true,
    user: { name: "Camila Santos", email: "camila@moinhos.com", role: "MANAGER" },
  },
  {
    id: "emp-005",
    cpf: "42345678905",
    position: "GERENTE",
    department: "AMBOS",
    contract_type: "CLT",
    hire_date: "2023-08-20",
    is_active: true,
    user: { name: "Patricia Menezes", email: "patricia@moinhos.com", role: "ADMIN" },
  },
  {
    id: "emp-006",
    cpf: "52345678906",
    position: "RECEPCAO",
    department: "ADMIN",
    contract_type: "CLT",
    hire_date: "2024-09-01",
    is_active: true,
    user: { name: "Juliana Costa", email: "juliana@moinhos.com", role: "MANAGER" },
  },
];

// ═══════════════════════════════════════════
// PROPRIETÁRIOS
// ═══════════════════════════════════════════

export const MOCK_OWNERS = [
  { id: "own-001", name: "Carlos Alberto Mendes", cpf_cnpj: "78945612300", person_type: "PF", phone: "(51) 99876-5432", email: "carlos.mendes@gmail.com", is_active: true },
  { id: "own-002", name: "Imobiliária Gaúcha Ltda", cpf_cnpj: "12345678000190", person_type: "PJ", phone: "(51) 3222-4567", email: "contato@imobgaucha.com.br", is_active: true },
  { id: "own-003", name: "Maria Helena Ferreira", cpf_cnpj: "98765432100", person_type: "PF", phone: "(51) 99123-4567", email: "mhelena@hotmail.com", is_active: true },
  { id: "own-004", name: "Construtora Bento Gonçalves S.A.", cpf_cnpj: "98765432000187", person_type: "PJ", phone: "(51) 3344-5566", email: "financeiro@bentogoncalves.com.br", is_active: true },
  { id: "own-005", name: "Roberto Lemos da Silva", cpf_cnpj: "45612378900", person_type: "PF", phone: "(51) 98765-1234", email: "rlemos@gmail.com", is_active: true },
];

// ═══════════════════════════════════════════
// CLIENTES (INQUILINOS / COMPRADORES)
// ═══════════════════════════════════════════

export const MOCK_CLIENTS = [
  { id: "cli-001", name: "João Pedro Almeida", cpf_cnpj: "11122233344", person_type: "PF", phone: "(51) 99111-2222", email: "joao.almeida@gmail.com", is_active: true },
  { id: "cli-002", name: "Tech Solutions Ltda", cpf_cnpj: "55667788000199", person_type: "PJ", phone: "(51) 3211-8899", email: "adm@techsolutions.com.br", is_active: true },
  { id: "cli-003", name: "Ana Beatriz Correia", cpf_cnpj: "22233344455", person_type: "PF", phone: "(51) 99333-4444", email: "anab.correia@outlook.com", is_active: true },
  { id: "cli-004", name: "Clínica Bem Estar S.S.", cpf_cnpj: "11223344000155", person_type: "PJ", phone: "(51) 3255-6677", email: "clinica@bemestar.com.br", is_active: true },
  { id: "cli-005", name: "Felipe Ramos Costa", cpf_cnpj: "33344455566", person_type: "PF", phone: "(51) 99555-6666", email: "felipe.rc@gmail.com", is_active: true },
  { id: "cli-006", name: "Escritório Monteiro Advocacia", cpf_cnpj: "99887766000133", person_type: "PJ", phone: "(51) 3299-1122", email: "adm@monteiro.adv.br", is_active: true },
];

// ═══════════════════════════════════════════
// IMÓVEIS
// ═══════════════════════════════════════════

export const MOCK_PROPERTIES = [
  { id: "prop-001", via_code: "VIA-4521", address_street: "Av. Independência", address_number: "1200", address_complement: "Apto 301", address_neighborhood: "Moinhos de Vento", property_type: "APARTAMENTO", status: "LOCADO", rent_value: "3200.00", sale_value: null, owner: { name: "Carlos Alberto Mendes" } },
  { id: "prop-002", via_code: "VIA-4522", address_street: "Rua Padre Chagas", address_number: "79", address_complement: "Conj 502", address_neighborhood: "Moinhos de Vento", property_type: "SALA", status: "DISPONIVEL", rent_value: "4800.00", sale_value: null, owner: { name: "Imobiliária Gaúcha Ltda" } },
  { id: "prop-003", via_code: "VIA-4523", address_street: "Rua Mostardeiro", address_number: "333", address_complement: null, address_neighborhood: "Moinhos de Vento", property_type: "CASA", status: "DISPONIVEL", rent_value: null, sale_value: "1250000.00", owner: { name: "Maria Helena Ferreira" } },
  { id: "prop-004", via_code: "VIA-4524", address_street: "Av. Goethe", address_number: "55", address_complement: "Apto 1501", address_neighborhood: "Moinhos de Vento", property_type: "APARTAMENTO", status: "LOCADO", rent_value: "5500.00", sale_value: null, owner: { name: "Construtora Bento Gonçalves S.A." } },
  { id: "prop-005", via_code: "VIA-4525", address_street: "Rua Dona Laura", address_number: "320", address_complement: "Sala 3", address_neighborhood: "Rio Branco", property_type: "COMERCIAL", status: "DISPONIVEL", rent_value: "2800.00", sale_value: null, owner: { name: "Roberto Lemos da Silva" } },
  { id: "prop-006", via_code: "VIA-4526", address_street: "Rua Quintino Bocaiúva", address_number: "890", address_complement: "Apto 202", address_neighborhood: "Moinhos de Vento", property_type: "APARTAMENTO", status: "VENDIDO", rent_value: null, sale_value: "890000.00", owner: { name: "Carlos Alberto Mendes" } },
  { id: "prop-007", via_code: "VIA-4527", address_street: "Rua Comendador Caminha", address_number: "145", address_complement: null, address_neighborhood: "Moinhos de Vento", property_type: "CASA", status: "LOCADO", rent_value: "7200.00", sale_value: null, owner: { name: "Maria Helena Ferreira" } },
  { id: "prop-008", via_code: "VIA-4528", address_street: "Av. 24 de Outubro", address_number: "1100", address_complement: "Loja 2", address_neighborhood: "Auxiliadora", property_type: "COMERCIAL", status: "INATIVO", rent_value: "6500.00", sale_value: null, owner: { name: "Imobiliária Gaúcha Ltda" } },
];

// ═══════════════════════════════════════════
// CAMPANHAS
// ═══════════════════════════════════════════

export const MOCK_CAMPAIGNS = [
  { id: "camp-001", name: "Campanha Sucesso Q1 2026", campaign_type: "SUCESSO_LOCACAO", start_date: "2026-01-01T00:00:00Z", end_date: "2026-03-31T00:00:00Z", reward_type: "FIXO", reward_amount: "100.00", status: "ENCERRADA", description: "R$100 por contrato de locação fechado no primeiro trimestre" },
  { id: "camp-002", name: "Captação Moinhos Abril", campaign_type: "CAPTACAO", start_date: "2026-04-01T00:00:00Z", end_date: "2026-04-30T00:00:00Z", reward_type: "FIXO", reward_amount: "50.00", status: "ATIVA", description: "R$50 por imóvel captado no bairro Moinhos de Vento" },
  { id: "camp-003", name: "Locação Semestral 2026", campaign_type: "LOCACAO_SEMESTRAL", start_date: "2026-01-01T00:00:00Z", end_date: "2026-06-30T00:00:00Z", reward_type: "FIXO", reward_amount: "200.00", status: "ATIVA", description: "Bônus de R$200 para quem fechar 15+ locações no semestre" },
  { id: "camp-004", name: "Campanha Sucesso Q2 2026", campaign_type: "SUCESSO_LOCACAO", start_date: "2026-04-01T00:00:00Z", end_date: "2026-06-30T00:00:00Z", reward_type: "FIXO", reward_amount: "120.00", status: "ATIVA", description: "R$120 por contrato fechado no segundo trimestre" },
];

// ═══════════════════════════════════════════
// DADOS FINANCEIROS MENSAIS (para gráficos)
// ═══════════════════════════════════════════

export const MOCK_FINANCIAL_MONTHLY = [
  { mes: "Out", receita: 98000, despesa: 62000, lucro: 36000 },
  { mes: "Nov", receita: 112000, despesa: 68000, lucro: 44000 },
  { mes: "Dez", receita: 145000, despesa: 78000, lucro: 67000 },
  { mes: "Jan", receita: 125400, despesa: 72000, lucro: 53400 },
  { mes: "Fev", receita: 118000, despesa: 69000, lucro: 49000 },
  { mes: "Mar", receita: 138000, despesa: 75000, lucro: 63000 },
  { mes: "Abr", receita: 142000, despesa: 71000, lucro: 71000 },
];

export const MOCK_EXPENSE_CATEGORIES_PIE = [
  { name: "Folha de Pagamentos", value: 28500, color: "#3b82f6" },
  { name: "Impostos e Tributos", value: 15600, color: "#ef4444" },
  { name: "Contas de Consumo", value: 8200, color: "#f59e0b" },
  { name: "Marketing", value: 6500, color: "#8b5cf6" },
  { name: "Manutenção", value: 5200, color: "#10b981" },
  { name: "Material", value: 3800, color: "#6366f1" },
  { name: "Tarifas Bancárias", value: 2100, color: "#64748b" },
  { name: "Espaço Físico", value: 1100, color: "#ec4899" },
];

export const MOCK_REVENUE_BY_TYPE = [
  { name: "Intermediação", value: 68000, color: "#3b82f6" },
  { name: "Agenciamento", value: 32000, color: "#10b981" },
  { name: "Taxa Admin.", value: 24000, color: "#f59e0b" },
  { name: "NFSe Aluguel", value: 12000, color: "#8b5cf6" },
  { name: "Campanhas", value: 6000, color: "#ef4444" },
];
