import "server-only";

import { hash } from "bcryptjs";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/server/audit";
import type { AuthContext } from "@/server/authz";
import { appConfig } from "@/server/env";
import { ensureFoundationSchema } from "@/server/foundation-schema";

type Db = PrismaClient | Prisma.TransactionClient;

const fixturePasswordHashPromise = hash("hml-fixture-login-disabled", 12);

function envUsers() {
  const users: Array<{ id: string; name: string; email: string; role: "ADMIN" | "MANAGER" }> = [];
  const adminEmail = process.env.AUTH_ADMIN_EMAIL?.toLowerCase();
  if (adminEmail) {
    users.push({
      id: "hml-admin-master",
      name: process.env.AUTH_ADMIN_NAME ?? "Admin Master",
      email: adminEmail,
      role: "ADMIN",
    });
  }

  const legacyOwner = process.env.AUTH_DONO_EMAIL?.toLowerCase();
  if (legacyOwner) {
    users.push({
      id: "hml-owner-legacy",
      name: process.env.AUTH_DONO_NAME ?? "Dono",
      email: legacyOwner,
      role: "MANAGER",
    });
  }

  for (const slot of ["1", "2"]) {
    const email = process.env[`AUTH_OWNER_${slot}_EMAIL`]?.toLowerCase();
    if (!email) continue;
    users.push({
      id: `hml-owner-${slot}`,
      name: process.env[`AUTH_OWNER_${slot}_NAME`] ?? `Dono ${slot}`,
      email,
      role: "MANAGER",
    });
  }

  return users.filter((user, index, list) => list.findIndex((item) => item.email === user.email) === index);
}

export function assertHmlWritable() {
  if (appConfig.isProduction) {
    throw new Error("Reset/seed de HML bloqueado em production.");
  }
}

export async function resetOperationalData() {
  assertHmlWritable();
  await ensureFoundationSchema();

  await prisma.$transaction(async (tx) => {
    await tx.webhookLog.deleteMany({});
    await tx.royaltyPayment.deleteMany({});
    await tx.payrollEntry.deleteMany({});
    await tx.campaignEntry.deleteMany({});
    await tx.campaign.deleteMany({});
    await tx.commissionCalculation.deleteMany({});
    await tx.commissionAdvance.deleteMany({});
    await tx.invoice.deleteMany({});
    await tx.bankTransaction.deleteMany({});
    await tx.document.deleteMany({});
    await tx.expense.deleteMany({});
    await tx.revenue.deleteMany({});
    await tx.contract.deleteMany({});
    await tx.property.deleteMany({});
    await tx.client.deleteMany({});
    await tx.propertyOwner.deleteMany({});
    await tx.employee.deleteMany({});
    await tx.supplier.deleteMany({});
    await tx.bankClassificationRule.deleteMany({});
    await tx.commissionRule.deleteMany({});
    await tx.expenseCategory.deleteMany({});
    await tx.bankAccount.deleteMany({});
  });
}

async function seedUsers(db: Db) {
  const password_hash = await fixturePasswordHashPromise;
  const authUsers = envUsers();

  for (const user of authUsers) {
    await db.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, is_active: true },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        password_hash,
        role: user.role,
        is_active: true,
      },
    });
  }

  const operationalUsers = [
    { id: "hml-user-consultor", name: "Carla Consultora", email: "carla.consultora@hml.local" },
    { id: "hml-user-captador", name: "Pedro Captador", email: "pedro.captador@hml.local" },
    { id: "hml-user-admin", name: "Ana Administrativo", email: "ana.adm@hml.local" },
  ];

  for (const user of operationalUsers) {
    await db.user.upsert({
      where: { email: user.email },
      update: { name: user.name, is_active: true },
      create: {
        ...user,
        password_hash,
        role: "MANAGER",
        is_active: true,
      },
    });
  }
}

async function seedCategories(db: Db) {
  const roots = [
    { id: "hml-cat-consumo", code: "HML_CONS", name: "Contas de Consumo", department: "AMBOS" as const },
    { id: "hml-cat-material", code: "HML_MAT", name: "Material e Compras", department: "AMBOS" as const },
    { id: "hml-cat-manut", code: "HML_MAN", name: "Manutencao", department: "AMBOS" as const },
    { id: "hml-cat-folha", code: "HML_FOLHA", name: "Folha e Comissoes", department: "AMBOS" as const },
    { id: "hml-cat-tributos", code: "HML_TRIB", name: "Impostos e Tributos", department: "AMBOS" as const },
    { id: "hml-cat-marketing", code: "HML_MKT", name: "Marketing e Portais", department: "VENDA" as const },
  ];

  for (const [index, item] of roots.entries()) {
    await db.expenseCategory.upsert({
      where: { code: item.code },
      update: { name: item.name, department: item.department, is_active: true },
      create: { ...item, sort_order: index * 100 },
    });
  }

  const children = [
    ["HML_CONS.01", "Energia Eletrica", "hml-cat-consumo"],
    ["HML_CONS.02", "Internet e Telefonia", "hml-cat-consumo"],
    ["HML_MAT.01", "Mercado e Copa", "hml-cat-material"],
    ["HML_MAT.02", "Farmacia", "hml-cat-material"],
    ["HML_MAN.01", "Ferragens e Reparos", "hml-cat-manut"],
    ["HML_FOLHA.01", "Comissoes Corretores", "hml-cat-folha"],
    ["HML_TRIB.01", "ISS", "hml-cat-tributos"],
    ["HML_MKT.01", "Portais Imobiliarios", "hml-cat-marketing"],
  ] as const;

  for (const [index, [code, name, parentId]] of children.entries()) {
    await db.expenseCategory.upsert({
      where: { code },
      update: { name, parent_id: parentId, is_active: true },
      create: {
        code,
        name,
        parent_id: parentId,
        department: code.startsWith("HML_MKT") ? "VENDA" : "AMBOS",
        sort_order: index,
      },
    });
  }
}

async function seedCoreRecords(db: Db) {
  await db.bankAccount.upsert({
    where: { id: "hml-caixa" },
    update: { is_active: true },
    create: {
      id: "hml-caixa",
      bank_name: "Caixa Economica Federal",
      bank_code: "104",
      account_number: "HML-0001",
      account_type: "CORRENTE",
      current_balance: 125000,
      is_active: true,
    },
  });

  const owner = await db.propertyOwner.upsert({
    where: { cpf_cnpj: "11122233344" },
    update: { is_active: true },
    create: {
      id: "hml-owner-fixture",
      name: "Maria Proprietaria HML",
      cpf_cnpj: "11122233344",
      person_type: "PF",
      email: "maria.proprietaria@hml.local",
      phone: "(51) 99999-1000",
      bank_name: "Caixa",
      bank_agency: "0001",
      bank_account: "12345-6",
      bank_pix: "11122233344",
      is_active: true,
    },
  });

  const client = await db.client.upsert({
    where: { cpf_cnpj: "55566677788" },
    update: { is_active: true },
    create: {
      id: "hml-client-fixture",
      name: "Joao Locatario HML",
      cpf_cnpj: "55566677788",
      person_type: "PF",
      email: "joao.locatario@hml.local",
      phone: "(51) 99999-2000",
      address: "Rua Teste HML, 100",
      is_active: true,
    },
  });

  const property = await db.property.upsert({
    where: { id: "hml-property-fixture" },
    update: { status: "LOCADO", is_active: true },
    create: {
      id: "hml-property-fixture",
      via_code: "HML-IMOVEL-001",
      owner_id: owner.id,
      address_street: "Rua Teste HML",
      address_number: "100",
      address_neighborhood: "Centro",
      address_city: "Porto Alegre",
      address_state: "RS",
      address_cep: "90000-000",
      property_type: "APARTAMENTO",
      status: "LOCADO",
      rent_value: 2500,
      is_active: true,
    },
  });

  await db.employee.upsert({
    where: { cpf: "10020030040" },
    update: { is_active: true },
    create: {
      id: "hml-employee-consultor",
      user_id: "hml-user-consultor",
      cpf: "10020030040",
      position: "CONSULTOR",
      department: "LOCACAO",
      hire_date: new Date("2025-01-10"),
      contract_type: "CONTRACT",
      base_salary: 0,
      is_active: true,
    },
  });

  await db.employee.upsert({
    where: { cpf: "20030040050" },
    update: { is_active: true },
    create: {
      id: "hml-employee-captador",
      user_id: "hml-user-captador",
      cpf: "20030040050",
      position: "CAPTADOR",
      department: "LOCACAO",
      hire_date: new Date("2025-01-10"),
      contract_type: "CONTRACT",
      base_salary: 0,
      is_active: true,
    },
  });

  await db.employee.upsert({
    where: { cpf: "30040050060" },
    update: { is_active: true },
    create: {
      id: "hml-employee-admin",
      user_id: "hml-user-admin",
      cpf: "30040050060",
      position: "RECEPCAO",
      department: "ADMIN",
      hire_date: new Date("2025-01-10"),
      contract_type: "CLT",
      base_salary: 3200,
      is_active: true,
    },
  });

  const contract = await db.contract.upsert({
    where: { contract_number: "HML-CTR-001" },
    update: { status: "ATIVO" },
    create: {
      id: "hml-contract-fixture",
      contract_number: "HML-CTR-001",
      via_code: "HML-VIA-001",
      property_id: property.id,
      client_id: client.id,
      consultant_id: "hml-employee-consultor",
      captador_id: "hml-employee-captador",
      contract_type: "LOCACAO",
      status: "ATIVO",
      start_date: new Date("2026-05-01"),
      end_date: new Date("2027-04-30"),
      rent_value: 2500,
      intermediation_value: 2500,
      agency_value: 875,
      franchise_intermediation_value: 1625,
      admin_fee_percentage: 10,
      guarantee_type: "SEGURO_FIANCA",
      inspection_status: "REALIZADA",
      key_status: "ENTREGUE",
      created_by: "hml-user-admin",
    },
  });

  await db.revenue.upsert({
    where: { id: "hml-revenue-intermediacao" },
    update: {},
    create: {
      id: "hml-revenue-intermediacao",
      contract_id: contract.id,
      category: "INTERMEDIACAO",
      description: "Intermediacao contrato HML-CTR-001",
      amount: 2500,
      date: new Date("2026-05-03"),
      department: "LOCACAO",
      reference_month: 5,
      reference_year: 2026,
      created_by: "hml-user-admin",
    },
  });

  await db.expense.upsert({
    where: { id: "hml-expense-mercado" },
    update: {},
    create: {
      id: "hml-expense-mercado",
      category_id: "hml-cat-material",
      description: "Compra mercado copa escritorio",
      amount: 289.9,
      date: new Date("2026-05-03"),
      department: "ADMIN",
      payment_method: "PIX",
      status: "PAGO",
      reference_month: 5,
      reference_year: 2026,
      supplier: "Mercado HML",
      created_by: "hml-user-admin",
    },
  });
}

async function seedRulesAndOperationalFlow(db: Db) {
  const commissionRules = [
    ["CONSULTOR_INTERMEDIACAO", 0, 3, 10, null, "Consultor ate 3 locacoes"],
    ["CONSULTOR_INTERMEDIACAO", 4, 9, 11, null, "Consultor 4 a 9 locacoes"],
    ["CONSULTOR_INTERMEDIACAO", 10, null, 13, null, "Consultor acima de 10 locacoes"],
    ["CAPTADOR_INTERMEDIACAO", 0, 15, 10, null, "Captador ate 15 imoveis"],
    ["CAPTADOR_BONUS", 0, null, null, 50, "Bonus por imovel captado"],
    ["VENDA", 0, null, 6, null, "Venda sobre comissao ajustada"],
    ["CAMPANHA_SUCESSO", 0, null, null, 100, "Campanha sucesso locacao"],
  ] as const;

  await db.commissionRule.deleteMany({});
  for (const [rule_type, min_threshold, max_threshold, percentage, fixed_amount, description] of commissionRules) {
    await db.commissionRule.create({
      data: {
        rule_type,
        min_threshold,
        max_threshold,
        percentage,
        fixed_amount,
        effective_from: new Date("2026-01-01"),
        description,
      },
    });
  }

  await db.campaign.upsert({
    where: { id: "hml-campaign-sucesso" },
    update: { status: "ATIVA" },
    create: {
      id: "hml-campaign-sucesso",
      name: "HML Sucesso Locacao",
      campaign_type: "SUCESSO_LOCACAO",
      start_date: new Date("2026-05-01"),
      reward_type: "FIXO",
      reward_amount: 100,
      status: "ATIVA",
      created_by: "hml-user-admin",
    },
  });

  await db.campaignEntry.upsert({
    where: { id: "hml-campaign-entry-001" },
    update: { status: "APROVADO" },
    create: {
      id: "hml-campaign-entry-001",
      campaign_id: "hml-campaign-sucesso",
      employee_id: "hml-employee-consultor",
      contract_id: "hml-contract-fixture",
      property_id: "hml-property-fixture",
      amount: 100,
      reference_month: 5,
      reference_year: 2026,
      status: "APROVADO",
      approved_by: "hml-user-admin",
    },
  });

  await db.commissionCalculation.upsert({
    where: { employee_id_reference_month_reference_year: { employee_id: "hml-employee-consultor", reference_month: 5, reference_year: 2026 } },
    update: { status: "CALCULADO" },
    create: {
      id: "hml-commission-consultor-2026-05",
      employee_id: "hml-employee-consultor",
      reference_month: 5,
      reference_year: 2026,
      rental_count: 1,
      capture_count: 0,
      total_intermediation_value: 2500,
      tier_applied: "Tier 1",
      intermediation_commission: 250,
      campaign_success_amount: 100,
      campaign_capture_amount: 0,
      sale_commission: 0,
      total_commission: 350,
      status: "CALCULADO",
      created_by: "hml-user-admin",
    },
  });

  await db.payrollEntry.upsert({
    where: { employee_id_reference_month_reference_year: { employee_id: "hml-employee-consultor", reference_month: 5, reference_year: 2026 } },
    update: { status: "CALCULADO" },
    create: {
      id: "hml-payroll-consultor-2026-05",
      employee_id: "hml-employee-consultor",
      reference_month: 5,
      reference_year: 2026,
      base_salary: 0,
      commission: 350,
      food_allowance: 0,
      transport_allowance: 0,
      vacation_pay: 0,
      thirteenth_salary: 0,
      other_earnings: 0,
      inss_deduction: 0,
      irrf_deduction: 0,
      fgts: 0,
      other_deductions: 0,
      advance_deductions: 0,
      total_gross: 350,
      total_deductions: 0,
      total_net: 350,
      department_split_sale: 0,
      department_split_rental: 100,
      status: "CALCULADO",
      created_by: "hml-user-admin",
    },
  });

  await db.supplier.upsert({
    where: { classification_key: "mercado-hml" },
    update: { is_active: true, total_moved: 289.9, transaction_count: 1 },
    create: {
      name: "Mercado HML",
      category_id: "hml-cat-material",
      classification_key: "mercado-hml",
      default_category: "Material e Compras",
      confidence: 95,
      total_moved: 289.9,
      transaction_count: 1,
      is_active: true,
    },
  });
}

export async function seedHmlData(ctx: AuthContext) {
  assertHmlWritable();
  await ensureFoundationSchema();

  await prisma.$transaction(async (tx) => {
    await seedUsers(tx);
    await seedCategories(tx);
    await seedCoreRecords(tx);
    await seedRulesAndOperationalFlow(tx);
  });

  await auditEvent({
    action: "system.hml_seeded",
    actorId: ctx.dbUserId,
    actorEmail: ctx.email,
    actorType: "HUMAN",
    entityType: "system",
    entityLabel: "HML fixtures",
    summary: "Dados base de HML preparados para validacao ponta a ponta.",
    severity: "WARN",
  });
}

export async function hmlReadinessSnapshot() {
  await ensureFoundationSchema();
  const [
    users,
    categories,
    bankAccounts,
    owners,
    clients,
    employees,
    properties,
    contracts,
    revenues,
    expenses,
    invoices,
    campaigns,
    commissions,
    payroll,
    bankTransactions,
  ] = await Promise.all([
    prisma.user.count({ where: { is_active: true } }),
    prisma.expenseCategory.count({ where: { is_active: true } }),
    prisma.bankAccount.count({ where: { is_active: true } }),
    prisma.propertyOwner.count({ where: { is_active: true } }),
    prisma.client.count({ where: { is_active: true } }),
    prisma.employee.count({ where: { is_active: true } }),
    prisma.property.count({ where: { is_active: true } }),
    prisma.contract.count(),
    prisma.revenue.count(),
    prisma.expense.count(),
    prisma.invoice.count(),
    prisma.campaign.count(),
    prisma.commissionCalculation.count(),
    prisma.payrollEntry.count(),
    prisma.bankTransaction.count(),
  ]);

  const checks = [
    { id: "users", label: "Usuarios ativos", count: users, minimum: 1 },
    { id: "categories", label: "Categorias", count: categories, minimum: 8 },
    { id: "bankAccounts", label: "Contas bancarias", count: bankAccounts, minimum: 1 },
    { id: "owners", label: "Proprietarios", count: owners, minimum: 1 },
    { id: "clients", label: "Clientes", count: clients, minimum: 1 },
    { id: "employees", label: "Corretores/equipe", count: employees, minimum: 2 },
    { id: "properties", label: "Imoveis", count: properties, minimum: 1 },
    { id: "contracts", label: "Contratos", count: contracts, minimum: 1 },
    { id: "financial", label: "Receitas/despesas", count: revenues + expenses, minimum: 2 },
    { id: "campaigns", label: "Campanhas", count: campaigns, minimum: 1 },
    { id: "commissions", label: "Comissoes", count: commissions, minimum: 1 },
    { id: "payroll", label: "Folha", count: payroll, minimum: 1 },
    { id: "bankTransactions", label: "Transacoes bancarias", count: bankTransactions, minimum: 0 },
    { id: "invoices", label: "Notas fiscais", count: invoices, minimum: 0 },
  ];

  return {
    checks: checks.map((item) => ({ ...item, ok: item.count >= item.minimum })),
    ready: checks.every((item) => item.count >= item.minimum),
    totals: {
      users,
      categories,
      bankAccounts,
      owners,
      clients,
      employees,
      properties,
      contracts,
      revenues,
      expenses,
      invoices,
      campaigns,
      commissions,
      payroll,
      bankTransactions,
    },
  };
}
