/**
 * extrato-store.ts
 * ----------------
 * Store in-memory para extratos bancários — agrupamento mensal.
 * Cada upload cria um "statement" (extrato mensal) com suas transações.
 */

import { suggestCategory, CATEGORIES, type CategoryName } from "@/lib/utils/bank-parsers";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  operationType: string;
  isCredit: boolean;
  category: CategoryName;
  /** Se o usuário corrigiu manualmente a categoria */
  categoryManual: boolean;
}

export interface MonthStatement {
  id: string;
  /** "2026-01", "2026-02", etc */
  monthKey: string;
  label: string;
  bankName: string;
  accountInfo?: string;
  importedAt: string;
  transactions: Transaction[];
}

// ─── Store singleton ─────────────────────────────────────────────────────────

const globalForStore = globalThis as unknown as {
  __extratoStore: Map<string, MonthStatement> | undefined;
  __extratoStoreVersion: number | undefined;
};

const STORE_VERSION = 1;

function getStore(): Map<string, MonthStatement> {
  if (!globalForStore.__extratoStore || globalForStore.__extratoStoreVersion !== STORE_VERSION) {
    globalForStore.__extratoStore = new Map();
    globalForStore.__extratoStoreVersion = STORE_VERSION;
  }
  return globalForStore.__extratoStore;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function monthKeyFromDate(dateStr: string): string {
  // dateStr = "2026-04-15" → "2026-04"
  return dateStr.substring(0, 7);
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_LABELS[parseInt(month) - 1]} ${year}`;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export interface ImportInput {
  date: string;
  description: string;
  amount: number;
  balance?: number;
  operationType: string;
  isCredit: boolean;
}

/**
 * Importa transações parseadas, agrupa por mês e cria/atualiza statements.
 * Retorna os statements criados/atualizados.
 */
export function importTransactions(
  parsed: ImportInput[],
  bankName: string,
  accountInfo?: string
): MonthStatement[] {
  const store = getStore();

  // Agrupa transações por mês
  const byMonth = new Map<string, ImportInput[]>();
  for (const tx of parsed) {
    const key = monthKeyFromDate(tx.date);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(tx);
  }

  const results: MonthStatement[] = [];

  for (const [key, txs] of byMonth) {
    let statement = store.get(key);

    if (!statement) {
      statement = {
        id: `stmt-${key}-${Date.now()}`,
        monthKey: key,
        label: monthLabel(key),
        bankName,
        accountInfo,
        importedAt: new Date().toISOString(),
        transactions: [],
      };
    }

    // Adiciona novas transações (evita duplicatas por data+descrição+valor)
    const existingKeys = new Set(
      statement.transactions.map((t) => `${t.date}|${t.description}|${t.amount}`)
    );

    for (const tx of txs) {
      const txKey = `${tx.date}|${tx.description}|${tx.amount}`;
      if (existingKeys.has(txKey)) continue;

      const category = suggestCategory(tx.description);
      // Se é crédito e ficou "Outros", reclassifica como receita genérica
      const finalCategory: CategoryName =
        tx.isCredit && category === "Outros" ? "Outras Receitas" : category;

      statement.transactions.push({
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        balance: tx.balance,
        operationType: tx.operationType,
        isCredit: tx.isCredit,
        category: finalCategory,
        categoryManual: false,
      });
    }

    // Ordena por data
    statement.transactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    store.set(key, statement);
    results.push(statement);
  }

  return results;
}

export function getAllStatements(): MonthStatement[] {
  const store = getStore();
  return Array.from(store.values()).sort(
    (a, b) => b.monthKey.localeCompare(a.monthKey) // mais recente primeiro
  );
}

export function getStatement(monthKey: string): MonthStatement | null {
  return getStore().get(monthKey) ?? null;
}

export function updateTransactionCategory(
  monthKey: string,
  txId: string,
  newCategory: CategoryName
): boolean {
  const statement = getStore().get(monthKey);
  if (!statement) return false;

  const tx = statement.transactions.find((t) => t.id === txId);
  if (!tx) return false;

  tx.category = newCategory;
  tx.categoryManual = true;
  return true;
}

export interface CategorySummary {
  category: CategoryName;
  total: number;
  count: number;
  type: "receita" | "despesa";
}

export function getCategorySummary(statement: MonthStatement): CategorySummary[] {
  const map = new Map<CategoryName, { total: number; count: number }>();

  for (const tx of statement.transactions) {
    const existing = map.get(tx.category) ?? { total: 0, count: 0 };
    existing.total += tx.amount;
    existing.count++;
    map.set(tx.category, existing);
  }

  return Array.from(map.entries())
    .map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      type: (CATEGORIES[category]?.type ?? "despesa") as "receita" | "despesa",
    }))
    .sort((a, b) => b.total - a.total);
}
