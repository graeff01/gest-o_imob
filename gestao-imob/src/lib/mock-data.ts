/**
 * mock-data.ts
 * ------------
 * Arrays vazios que servem de fallback quando o banco não está conectado.
 * Quando o PostgreSQL estiver online, os API routes retornam dados reais
 * e este arquivo é ignorado.
 *
 * A estrutura dos tipos espelha o schema Prisma.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_EMPLOYEES: any[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_OWNERS: any[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_CLIENTS: any[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_PROPERTIES: any[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_CAMPAIGNS: any[] = [];

// Dados financeiros — vazios até o banco estar conectado
export const MOCK_FINANCIAL_MONTHLY: { mes: string; receita: number; despesa: number; lucro: number }[] = [];
export const MOCK_EXPENSE_CATEGORIES_PIE: { name: string; value: number; color: string }[] = [];
export const MOCK_REVENUE_BY_TYPE: { name: string; value: number; color: string }[] = [];
