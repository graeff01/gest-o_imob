import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hash } from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando seed...");

  // =====================================================
  // 1. USUARIO ADMIN PADRAO
  // =====================================================
  const adminPassword = await hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@moinhos.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@moinhos.com",
      password_hash: adminPassword,
      role: "ADMIN",
      is_active: true,
    },
  });
  console.log("Usuario admin criado.");

  // =====================================================
  // 2. CATEGORIAS DE DESPESAS (extraidas da Planilha Financeiro MV 2026)
  // =====================================================

  // Categorias pai
  const categoriasRaiz = [
    { code: "CONS", name: "Contas de Consumo", department: "AMBOS" as const },
    { code: "MAT", name: "Material", department: "AMBOS" as const },
    { code: "MAN", name: "Manutencao", department: "AMBOS" as const },
    { code: "OP_VENDA", name: "Contas Operacionais Venda", department: "VENDA" as const },
    { code: "OP_LOC", name: "Contas Operacionais Locacao", department: "LOCACAO" as const },
    { code: "FOLHA_VENDA", name: "Folha de Pagamentos - Venda", department: "VENDA" as const },
    { code: "FOLHA_LOC", name: "Folha de Pagamentos - Locacao", department: "LOCACAO" as const },
    { code: "TARIFA", name: "Tarifas Bancarias", department: "AMBOS" as const },
    { code: "IMPOSTO", name: "Impostos e Tributos", department: "AMBOS" as const },
    { code: "GASTOS_ESP", name: "Gastos Espaco Fisico", department: "AMBOS" as const },
  ];

  const parentMap: Record<string, string> = {};

  for (const cat of categoriasRaiz) {
    const created = await prisma.expenseCategory.upsert({
      where: { code: cat.code },
      update: { name: cat.name, department: cat.department },
      create: {
        code: cat.code,
        name: cat.name,
        department: cat.department,
        sort_order: categoriasRaiz.indexOf(cat) * 100,
      },
    });
    parentMap[cat.code] = created.id;
  }

  // Subcategorias - Contas de Consumo
  const contasConsumo = [
    "Agua Mineral",
    "Aluguel/IPTU",
    "Celular Claro",
    "Celular TIM",
    "Celular Vivo",
    "Condominio",
    "Energia Eletrica",
    "Extintores",
    "Informatica/Internet",
    "Limpeza (servico)",
    "Seguranca/Monitoramento",
    "Telefone Fixo",
    "TV/Streaming",
  ];

  // Subcategorias - Material
  const material = [
    "Mantimentos/Cafe",
    "Material de Limpeza",
    "Material de Escritorio",
    "Material de Informatica",
  ];

  // Subcategorias - Manutencao
  const manutencao = [
    "Manutencao Geral",
    "Manutencao Informatica",
    "Manutencao Ar Condicionado",
    "Manutencao Eletrica",
    "Manutencao Hidraulica",
    "Outras Manutencoes",
  ];

  // Subcategorias - Contas Operacionais Venda
  const opVenda = [
    "Associacao de Marketing",
    "Material de Divulgacao",
    "Assinatura Digital/Aplicativo",
    "Campanha Captacao",
    "Campanha Sucesso Locacao",
    "Campanha Locacao Semestral",
    "Campanha Indicacao",
    "Cartoes de Visita",
    "Certidoes/Procuracao",
    "Chaves/Chaveiros",
    "CHECK-ON (software)",
    "CRECI PF",
    "CRECI PJ",
    "Folders/Panfletos",
    "Facebook Impulsionamento",
    "Instagram Impulsionamento",
    "Google Impulsionamento",
    "Google Mensal",
    "Lacres",
    "Motoboi/Motoboy",
    "Pastas",
    "Placas de Venda",
    "Placas de Locacao",
    "Placas Diversas",
    "Procob (sistema de credito)",
    "QR Code",
    "Toner/Cartucho",
    "Uber/Transporte",
    "Vistorias de Entrada",
    "Vistorias de Saida",
    "Fotografo/Tour Virtual",
    "Brindes/Presentes",
    "Eventos",
    "Outros Operacionais Venda",
  ];

  // Subcategorias - Contas Operacionais Locacao
  const opLocacao = [
    "Software Locacao",
    "Vistorias Locacao",
    "Seguros Locacao",
    "Certidoes Locacao",
    "Outros Operacionais Locacao",
  ];

  // Subcategorias - Folha Venda
  const folhaVenda = [
    "CIEE/Agiel",
    "Estagio-Seguro",
    "FGTS Venda",
    "GPS/INSS Venda",
    "GSO - Esocial Venda",
    "Pro-labore Venda",
    "VA (Vale Alimentacao) Venda",
    "VR (Vale Refeicao) Venda",
    "VT (Vale Transporte) Venda",
    "Recepcao",
    "Substituicao Ferias Venda",
    "SECOM Venda",
    "VIMED/Plano Saude Venda",
    "Salarios Venda",
    "Rescisoes Venda",
    "Ferias Venda",
    "13o Salario Venda",
    "Horas Extras Venda",
    "Outros Folha Venda",
  ];

  // Subcategorias - Folha Locacao
  const folhaLocacao = [
    "FGTS Locacao",
    "GPS/INSS Locacao",
    "GSO - Esocial Locacao",
    "Pro-labore Locacao",
    "VA (Vale Alimentacao) Locacao",
    "VR (Vale Refeicao) Locacao",
    "VT (Vale Transporte) Locacao",
    "Substituicao Ferias Locacao",
    "SECOM Locacao",
    "VIMED/Plano Saude Locacao",
    "Salarios Locacao",
    "Rescisoes Locacao",
    "Ferias Locacao",
    "13o Salario Locacao",
    "Horas Extras Locacao",
    "Outros Folha Locacao",
  ];

  // Subcategorias - Tarifas Bancarias
  const tarifas = [
    "TAR PIX",
    "Tarifa Boleto",
    "Tarifa TED/DOC",
    "Tarifa Cesta",
    "IOF",
    "Juros Bancarios",
    "Seguro Bancario",
    "Outras Tarifas",
  ];

  // Subcategorias - Impostos
  const impostos = [
    "ISS",
    "PIS",
    "COFINS",
    "IRPJ",
    "CSLL",
    "Simples Nacional",
    "IPTU",
    "Outros Impostos",
  ];

  // Subcategorias - Gastos Espaco Fisico
  const gastosEspaco = [
    "Aluguel Escritorio",
    "Condominio Escritorio",
    "IPTU Escritorio",
    "Seguro Escritorio",
    "Reforma/Obra",
    "Mobiliario",
    "Decoracao",
    "Outros Gastos Espaco",
  ];

  const subcategoriaMap: Record<string, { items: string[]; department: "VENDA" | "LOCACAO" | "ADMIN" | "AMBOS" }> = {
    CONS: { items: contasConsumo, department: "AMBOS" },
    MAT: { items: material, department: "AMBOS" },
    MAN: { items: manutencao, department: "AMBOS" },
    OP_VENDA: { items: opVenda, department: "VENDA" },
    OP_LOC: { items: opLocacao, department: "LOCACAO" },
    FOLHA_VENDA: { items: folhaVenda, department: "VENDA" },
    FOLHA_LOC: { items: folhaLocacao, department: "LOCACAO" },
    TARIFA: { items: tarifas, department: "AMBOS" },
    IMPOSTO: { items: impostos, department: "AMBOS" },
    GASTOS_ESP: { items: gastosEspaco, department: "AMBOS" },
  };

  let totalCategorias = categoriasRaiz.length;

  for (const [parentCode, { items, department }] of Object.entries(subcategoriaMap)) {
    for (let i = 0; i < items.length; i++) {
      const code = `${parentCode}.${String(i + 1).padStart(2, "0")}`;
      await prisma.expenseCategory.upsert({
        where: { code },
        update: { name: items[i], department, parent_id: parentMap[parentCode] },
        create: {
          code,
          name: items[i],
          department,
          parent_id: parentMap[parentCode],
          sort_order: i,
        },
      });
      totalCategorias++;
    }
  }

  console.log(`${totalCategorias} categorias de despesas criadas.`);

  // =====================================================
  // 3. REGRAS DE COMISSAO (extraidas de Comissionamentos.docx)
  // =====================================================

  // Limpar regras existentes para recriar
  await prisma.commissionRule.deleteMany({});

  const regras = [
    // Consultor - Intermediacao por tier
    {
      rule_type: "CONSULTOR_INTERMEDIACAO" as const,
      min_threshold: 0,
      max_threshold: 3,
      percentage: 10.0,
      description: "Consultor: ate 3 locacoes/mes = 10%",
      effective_from: new Date("2024-10-01"),
    },
    {
      rule_type: "CONSULTOR_INTERMEDIACAO" as const,
      min_threshold: 4,
      max_threshold: 9,
      percentage: 11.0,
      description: "Consultor: 4-9 locacoes/mes = 11%",
      effective_from: new Date("2024-10-01"),
    },
    {
      rule_type: "CONSULTOR_INTERMEDIACAO" as const,
      min_threshold: 10,
      max_threshold: null,
      percentage: 13.0,
      description: "Consultor: 10+ locacoes/mes = 13%",
      effective_from: new Date("2024-10-01"),
    },

    // Captador - Intermediacao por tier
    {
      rule_type: "CAPTADOR_INTERMEDIACAO" as const,
      min_threshold: 0,
      max_threshold: 15,
      percentage: 10.0,
      description: "Captador: ate 15 imoveis/mes = 10%",
      effective_from: new Date("2024-10-01"),
    },
    {
      rule_type: "CAPTADOR_INTERMEDIACAO" as const,
      min_threshold: 16,
      max_threshold: 20,
      percentage: 11.0,
      description: "Captador: 16-20 imoveis/mes = 11%",
      effective_from: new Date("2024-10-01"),
    },
    {
      rule_type: "CAPTADOR_INTERMEDIACAO" as const,
      min_threshold: 21,
      max_threshold: null,
      percentage: 13.0,
      description: "Captador: 21+ imoveis/mes = 13%",
      effective_from: new Date("2024-10-01"),
    },

    // Captador - Bonus por captacao
    {
      rule_type: "CAPTADOR_BONUS" as const,
      min_threshold: 0,
      max_threshold: null,
      fixed_amount: 50.0,
      description: "Captador: R$50 por imovel captado no perfil",
      effective_from: new Date("2024-10-01"),
    },

    // Venda - 6% sobre comissao
    {
      rule_type: "VENDA" as const,
      min_threshold: 0,
      max_threshold: null,
      percentage: 6.0,
      description: "Venda: 6% sobre valor de comissao ajustada",
      effective_from: new Date("2024-10-01"),
    },

    // Campanha Sucesso Locacao - R$100 por contrato
    {
      rule_type: "CAMPANHA_SUCESSO" as const,
      min_threshold: 0,
      max_threshold: null,
      fixed_amount: 100.0,
      description: "Campanha sucesso: R$100 por contrato de locacao fechado",
      effective_from: new Date("2024-10-01"),
    },

    // Campanha Captacao - R$50 por imovel
    {
      rule_type: "CAMPANHA_CAPTACAO" as const,
      min_threshold: 0,
      max_threshold: null,
      fixed_amount: 50.0,
      description: "Campanha captacao: R$50 por imovel no perfil",
      effective_from: new Date("2024-10-01"),
    },
  ];

  for (const regra of regras) {
    await prisma.commissionRule.create({
      data: {
        rule_type: regra.rule_type,
        min_threshold: regra.min_threshold,
        max_threshold: regra.max_threshold,
        percentage: regra.percentage ?? null,
        fixed_amount: regra.fixed_amount ?? null,
        effective_from: regra.effective_from,
        description: regra.description,
      },
    });
  }

  console.log(`${regras.length} regras de comissao criadas.`);

  // =====================================================
  // 4. CONTAS BANCARIAS PADRAO
  // =====================================================

  await prisma.bankAccount.upsert({
    where: { id: "caixa-economica" },
    update: {},
    create: {
      id: "caixa-economica",
      bank_name: "Caixa Economica Federal",
      bank_code: "104",
      account_number: "0001",
      account_type: "CORRENTE",
    },
  });

  await prisma.bankAccount.upsert({
    where: { id: "pipeimob" },
    update: {},
    create: {
      id: "pipeimob",
      bank_name: "Pipeimob",
      account_number: "principal",
      account_type: "PLATAFORMA",
    },
  });

  console.log("Contas bancarias criadas.");
  console.log("Seed concluido com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
