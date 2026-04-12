/**
 * invoice-store.ts
 * ----------------
 * Store in-memory para notas fiscais — usado quando não há DATABASE_URL.
 * Seed com dados realistas para validar o fluxo completo no navegador.
 *
 * Quando o Prisma estiver conectado, este arquivo é ignorado automaticamente.
 */

export interface InvoiceRecord {
  id: string;
  contract_id: string | null;
  nfse_number: number | null;
  year_sequence: number | null;
  reference_year: number;
  reference_month: number | null;
  client_name: string;
  client_cpf_cnpj: string;
  client_contact: string | null;
  property_code: string | null;
  property_address: string | null;
  service_type: string;
  title_number: string | null;
  amount: number;
  description_title: string;
  description_body: string;
  status: string;
  issued_at: string | null;
  sent_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  gateway_id: string | null;
  gateway_provider: string | null;
  gateway_status: string | null;
  gateway_pdf_url: string | null;
  gateway_xml_url: string | null;
  last_emit_error: string | null;
  last_emit_at: string | null;
  emit_attempts: number;
  imported_from_dw: boolean;
  dw_agency_name: string | null;
  notes: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Seed data (vazio — sistema começa limpo) ────────────────────────────────

const SEED_INVOICES: InvoiceRecord[] = [];

// ─── In-memory store (singleton via globalThis) ──────────────────────────────

const globalForStore = globalThis as unknown as {
  __invoiceStore: Map<string, InvoiceRecord> | undefined;
  __invoiceStoreVersion: number | undefined;
};

// Bump this version to force a reset of the in-memory store
const STORE_VERSION = 2;

function getStore(): Map<string, InvoiceRecord> {
  if (!globalForStore.__invoiceStore || globalForStore.__invoiceStoreVersion !== STORE_VERSION) {
    const map = new Map<string, InvoiceRecord>();
    for (const inv of SEED_INVOICES) {
      map.set(inv.id, { ...inv });
    }
    globalForStore.__invoiceStore = map;
    globalForStore.__invoiceStoreVersion = STORE_VERSION;
  }
  return globalForStore.__invoiceStore;
}

// ─── CRUD operations ─────────────────────────────────────────────────────────

export function findManyInvoices(filters?: {
  status?: string;
  search?: string;
  service_type?: string;
  year?: number;
}): InvoiceRecord[] {
  const store = getStore();
  let results = Array.from(store.values());

  if (filters?.status) {
    results = results.filter((i) => i.status === filters.status);
  }
  if (filters?.year) {
    results = results.filter((i) => i.reference_year === filters.year);
  }
  if (filters?.service_type) {
    results = results.filter((i) => i.service_type === filters.service_type);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (i) =>
        i.client_name.toLowerCase().includes(q) ||
        i.client_cpf_cnpj.includes(q) ||
        (i.property_address && i.property_address.toLowerCase().includes(q)) ||
        i.description_title.toLowerCase().includes(q)
    );
  }

  // Sort by created_at desc
  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return results;
}

export function findInvoiceById(id: string): InvoiceRecord | null {
  return getStore().get(id) ?? null;
}

export function createInvoice(data: Omit<InvoiceRecord, "id" | "created_at" | "updated_at">): InvoiceRecord {
  const store = getStore();
  const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const record: InvoiceRecord = { ...data, id, created_at: now, updated_at: now };
  store.set(id, record);
  return record;
}

export function updateInvoice(id: string, data: Partial<InvoiceRecord>): InvoiceRecord | null {
  const store = getStore();
  const existing = store.get(id);
  if (!existing) return null;

  const updated: InvoiceRecord = {
    ...existing,
    ...data,
    id, // never overwrite id
    updated_at: new Date().toISOString(),
  };
  store.set(id, updated);
  return updated;
}

export function getNextYearSequence(year: number): number {
  const store = getStore();
  let max = 0;
  for (const inv of store.values()) {
    if (inv.reference_year === year && inv.year_sequence && inv.year_sequence > max) {
      max = inv.year_sequence;
    }
  }
  return max + 1;
}

export function findByTitleNumbers(titleNumbers: string[]): { title_number: string | null; reference_year: number }[] {
  const store = getStore();
  const results: { title_number: string | null; reference_year: number }[] = [];
  const set = new Set(titleNumbers);
  for (const inv of store.values()) {
    if (inv.title_number && set.has(inv.title_number)) {
      results.push({ title_number: inv.title_number, reference_year: inv.reference_year });
    }
  }
  return results;
}

export function createManyInvoices(records: Omit<InvoiceRecord, "id" | "created_at" | "updated_at">[]): number {
  let count = 0;
  for (const data of records) {
    createInvoice(data);
    count++;
  }
  return count;
}
