"use client";

/**
 * CORE STORE â€” Fase A
 *
 * Camada Ãºnica de tipos + persistÃªncia para as entidades estruturais:
 *  - Fornecedor
 *  - ProprietÃ¡rio
 *  - ParÃ¢metros do sistema (versionados)
 *  - Log de auditoria (imutÃ¡vel)
 *  - Fila de exceÃ§Ãµes (caixa de entrada unificada)
 *
 * Toda persistÃªncia Ã© via localStorage com chaves versionadas.
 * Quando o banco for conectado, basta trocar a camada `read`/`write`
 * por chamadas Prisma â€” os tipos e a API pÃºblica permanecem.
 */

// â”€â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface Fornecedor {
  id: string;
  nome: string;
  cpfCnpj: string;
  categoriaPadrao?: string;
  subcategoriaPadrao?: string;
  /** ConfianÃ§a acumulada â€” quantas vezes a classificaÃ§Ã£o bateu */
  confiancaClassificacao: number;
  /** Total movimentado historicamente */
  totalMovimentado: number;
  quantidadeLancamentos: number;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Proprietario {
  id: string;
  nome: string;
  cpfCnpj: string;
  telefone?: string;
  email?: string;
  pix?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  /** IDs dos imÃ³veis do proprietÃ¡rio */
  imoveisIds: string[];
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * ParÃ¢metros do sistema â€” tudo que antes era hardcoded no cÃ³digo.
 * Cada mudanÃ§a vira uma nova versÃ£o preservando histÃ³rico.
 */
export interface ParametrosSistema {
  versao: number;
  vigenteDesde: string;
  // Financeiro
  taxaAdministracao: number; // % padrÃ£o (ex: 10)
  taxaAdministracaoReal: number; // % que vira receita real (ex: 3.5)
  percentualRepasseMatriz: number; // % repassado Ã  matriz (ex: 70)
  percentualReceitaAgencia: number; // % que fica na agÃªncia (ex: 30)
  // ComissÃµes
  consultorTier1Max: number; // atÃ© N locaÃ§Ãµes = tier 1
  consultorTier1Percent: number;
  consultorTier2Max: number;
  consultorTier2Percent: number;
  consultorTier3Percent: number;
  captadorTier1Max: number;
  captadorTier1Percent: number;
  captadorTier2Max: number;
  captadorTier2Percent: number;
  captadorTier3Percent: number;
  captadorBonusPorImovel: number;
  vendaPercent: number;
  campanhaSucessoValor: number;
  campanhaCaptacaoValor: number;
  // RÃ©gua de cobranÃ§a (dias apÃ³s vencimento)
  reguaAviso1: number;
  reguaAviso2: number;
  reguaAviso3: number;
  reguaJuridico: number;
  // Fiscais
  prazoEmissaoNF: number; // dia do mÃªs limite
  indiceReajustePadrao: "IGPM" | "IPCA";
  // IA
  scoreConfiancaAutoAprovacao: number; // >= este valor, aprova sozinho
  /** Autor da alteraÃ§Ã£o */
  alteradoPor?: string;
  /** Motivo da alteraÃ§Ã£o */
  motivo?: string;
}

export const PARAMETROS_DEFAULT: Omit<ParametrosSistema, "versao" | "vigenteDesde"> = {
  taxaAdministracao: 10,
  taxaAdministracaoReal: 3.5,
  percentualRepasseMatriz: 70,
  percentualReceitaAgencia: 30,
  consultorTier1Max: 3,
  consultorTier1Percent: 10,
  consultorTier2Max: 9,
  consultorTier2Percent: 11,
  consultorTier3Percent: 13,
  captadorTier1Max: 15,
  captadorTier1Percent: 10,
  captadorTier2Max: 20,
  captadorTier2Percent: 11,
  captadorTier3Percent: 13,
  captadorBonusPorImovel: 50,
  vendaPercent: 6,
  campanhaSucessoValor: 100,
  campanhaCaptacaoValor: 50,
  reguaAviso1: 1,
  reguaAviso2: 5,
  reguaAviso3: 15,
  reguaJuridico: 30,
  prazoEmissaoNF: 5,
  indiceReajustePadrao: "IGPM",
  scoreConfiancaAutoAprovacao: 95,
};

/**
 * Log de auditoria â€” imutÃ¡vel, append-only.
 * Toda aÃ§Ã£o relevante (humana ou IA) deve gerar um registro.
 */
export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "AI_CLASSIFY"
  | "AI_AUTO_APPROVE"
  | "LOGIN"
  | "EXPORT"
  | "CONFIG_CHANGE"
  | "IMPORT";

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string; // "Sistema IA" | nome do usuÃ¡rio
  actorType: "HUMAN" | "AI" | "SYSTEM";
  action: AuditAction;
  entityType: string; // "Fornecedor" | "Contrato" | "Parametros" | ...
  entityId?: string;
  entityLabel?: string;
  /** DescriÃ§Ã£o curta da mudanÃ§a */
  summary: string;
  /** Score de confianÃ§a da IA (quando aplicÃ¡vel) */
  confidence?: number;
  /** Dados antes/depois (diff) */
  diff?: { before?: unknown; after?: unknown };
}

/**
 * Fila de exceÃ§Ãµes â€” tudo que exige atenÃ§Ã£o humana.
 * Alimentada por IA e por validaÃ§Ãµes cruzadas.
 */
export type ExceptionSeverity = "INFO" | "WARN" | "CRITICAL";
export type ExceptionStatus = "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED";
export type ExceptionKind =
  | "AI_LOW_CONFIDENCE"
  | "DUPLICATE"
  | "DIVERGENCE"
  | "MISSING_LINK"
  | "ANOMALY"
  | "MANUAL_REVIEW";

export interface ExceptionItem {
  id: string;
  kind: ExceptionKind;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  title: string;
  description: string;
  /** MÃ³dulo de origem: "financeiro" | "contratos" | "nf" | ... */
  source: string;
  entityType?: string;
  entityId?: string;
  /** Valores relevantes pra contexto */
  meta?: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

// â”€â”€â”€ Chaves de storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const K = {
  fornecedores: "core-fornecedores-v1",
  proprietarios: "core-proprietarios-v1",
  parametros: "core-parametros-v1",
  audit: "core-audit-v1",
  exceptions: "core-exceptions-v1",
  seedVersion: "core-seed-version",
} as const;

const SEED_VERSION = 1;

const SEED_FORNECEDORES: Fornecedor[] = [
  { id: "forn-001", nome: "Fornecedor Exemplo 1", cpfCnpj: "00000000000000", categoriaPadrao: "Royalties", subcategoriaPadrao: "Royalties mensais", confiancaClassificacao: 98, totalMovimentado: 56400, quantidadeLancamentos: 12, observacoes: "Dados demonstrativos ficticios", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "forn-002", nome: "Fornecedor Exemplo 2", cpfCnpj: "00000000000000", categoriaPadrao: "Contas de Consumo", subcategoriaPadrao: "Telefone/Internet", confiancaClassificacao: 95, totalMovimentado: 5880, quantidadeLancamentos: 12, observacoes: "Dados demonstrativos ficticios", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "forn-003", nome: "Fornecedor Exemplo 3", cpfCnpj: "00000000000000", categoriaPadrao: "Marketing", subcategoriaPadrao: "Marketing digital", confiancaClassificacao: 85, totalMovimentado: 28800, quantidadeLancamentos: 12, observacoes: "Dados demonstrativos ficticios", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
];

const SEED_PROPRIETARIOS: Proprietario[] = [
  { id: "prop-own-001", nome: "Proprietario Exemplo 1", cpfCnpj: "00000000000", telefone: "(00) 90000-0001", email: "owner1@example.com", pix: "owner1@example.com", banco: "Banco Exemplo", agencia: "0000", conta: "00000-0", imoveisIds: ["prop-001"], observacoes: "Dados demonstrativos ficticios", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "prop-own-002", nome: "Proprietario Exemplo 2", cpfCnpj: "00000000000", telefone: "(00) 90000-0002", email: "owner2@example.com", pix: "owner2@example.com", banco: "Banco Exemplo", agencia: "0000", conta: "00000-0", imoveisIds: ["prop-002"], observacoes: "Dados demonstrativos ficticios", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "prop-own-003", nome: "Empresa Proprietaria Exemplo", cpfCnpj: "00000000000000", telefone: "(00) 3000-0000", email: "owner-company@example.com", pix: "owner-company@example.com", banco: "Banco Exemplo", agencia: "0000", conta: "00000-0", imoveisIds: ["prop-003"], observacoes: "Dados demonstrativos ficticios", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
];

function ensureSeeded() {
  if (typeof window === "undefined") return;
  const current = parseInt(localStorage.getItem(K.seedVersion) || "0");
  if (current >= SEED_VERSION) return;
  const existingForn = read<Fornecedor[]>(K.fornecedores, []);
  if (existingForn.length === 0) write(K.fornecedores, SEED_FORNECEDORES);
  const existingProps = read<Proprietario[]>(K.proprietarios, []);
  if (existingProps.length === 0) write(K.proprietarios, SEED_PROPRIETARIOS);
  localStorage.setItem(K.seedVersion, String(SEED_VERSION));
}

// â”€â”€â”€ Helpers internos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const now = () => new Date().toISOString();
const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// â”€â”€â”€ Audit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function logAudit(entry: Omit<AuditEntry, "id" | "timestamp">) {
  const log = read<AuditEntry[]>(K.audit, []);
  const full: AuditEntry = { id: uuid(), timestamp: now(), ...entry };
  // Append-only, limita a 10k entradas para nÃ£o estourar storage
  const next = [full, ...log].slice(0, 10000);
  write(K.audit, next);
  return full;
}

export function getAuditLog(): AuditEntry[] {
  return read<AuditEntry[]>(K.audit, []);
}

// â”€â”€â”€ Exceptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function raiseException(
  item: Omit<ExceptionItem, "id" | "createdAt" | "status">
): ExceptionItem {
  const list = read<ExceptionItem[]>(K.exceptions, []);
  const full: ExceptionItem = {
    id: uuid(),
    createdAt: now(),
    status: "OPEN",
    ...item,
  };
  write(K.exceptions, [full, ...list]);
  return full;
}

export function getExceptions(): ExceptionItem[] {
  return read<ExceptionItem[]>(K.exceptions, []);
}

export function updateException(id: string, patch: Partial<ExceptionItem>) {
  const list = read<ExceptionItem[]>(K.exceptions, []);
  const next = list.map((e) => (e.id === id ? { ...e, ...patch } : e));
  write(K.exceptions, next);
}

// â”€â”€â”€ Fornecedores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function getFornecedores(): Fornecedor[] {
  ensureSeeded();
  return read<Fornecedor[]>(K.fornecedores, []);
}

export function saveFornecedor(f: Omit<Fornecedor, "id" | "criadoEm" | "atualizadoEm"> & { id?: string }): Fornecedor {
  const list = getFornecedores();
  if (f.id) {
    const updated: Fornecedor = {
      ...(list.find((x) => x.id === f.id) as Fornecedor),
      ...f,
      id: f.id,
      atualizadoEm: now(),
    };
    write(K.fornecedores, list.map((x) => (x.id === f.id ? updated : x)));
    logAudit({
      actor: "Gestor",
      actorType: "HUMAN",
      action: "UPDATE",
      entityType: "Fornecedor",
      entityId: f.id,
      entityLabel: f.nome,
      summary: `Fornecedor ${f.nome} atualizado`,
    });
    return updated;
  }
  const novo: Fornecedor = {
    ...f,
    id: uuid(),
    criadoEm: now(),
    atualizadoEm: now(),
  };
  write(K.fornecedores, [novo, ...list]);
  logAudit({
    actor: "Gestor",
    actorType: "HUMAN",
    action: "CREATE",
    entityType: "Fornecedor",
    entityId: novo.id,
    entityLabel: novo.nome,
    summary: `Fornecedor ${novo.nome} cadastrado`,
  });
  return novo;
}

export function deleteFornecedor(id: string) {
  const list = getFornecedores();
  const f = list.find((x) => x.id === id);
  write(K.fornecedores, list.filter((x) => x.id !== id));
  if (f) {
    logAudit({
      actor: "Gestor",
      actorType: "HUMAN",
      action: "DELETE",
      entityType: "Fornecedor",
      entityId: id,
      entityLabel: f.nome,
      summary: `Fornecedor ${f.nome} removido`,
    });
  }
}

// â”€â”€â”€ ProprietÃ¡rios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function getProprietarios(): Proprietario[] {
  ensureSeeded();
  return read<Proprietario[]>(K.proprietarios, []);
}

export function saveProprietario(
  p: Omit<Proprietario, "id" | "criadoEm" | "atualizadoEm"> & { id?: string }
): Proprietario {
  const list = getProprietarios();
  if (p.id) {
    const existing = list.find((x) => x.id === p.id) as Proprietario;
    const updated: Proprietario = {
      ...existing,
      ...p,
      id: p.id,
      atualizadoEm: now(),
    };
    write(K.proprietarios, list.map((x) => (x.id === p.id ? updated : x)));
    logAudit({
      actor: "Gestor",
      actorType: "HUMAN",
      action: "UPDATE",
      entityType: "ProprietÃ¡rio",
      entityId: p.id,
      entityLabel: p.nome,
      summary: `ProprietÃ¡rio ${p.nome} atualizado`,
    });
    return updated;
  }
  const novo: Proprietario = {
    ...p,
    id: uuid(),
    criadoEm: now(),
    atualizadoEm: now(),
  };
  write(K.proprietarios, [novo, ...list]);
  logAudit({
    actor: "Gestor",
    actorType: "HUMAN",
    action: "CREATE",
    entityType: "ProprietÃ¡rio",
    entityId: novo.id,
    entityLabel: novo.nome,
    summary: `ProprietÃ¡rio ${novo.nome} cadastrado`,
  });
  return novo;
}

export function deleteProprietario(id: string) {
  const list = getProprietarios();
  const p = list.find((x) => x.id === id);
  write(K.proprietarios, list.filter((x) => x.id !== id));
  if (p) {
    logAudit({
      actor: "Gestor",
      actorType: "HUMAN",
      action: "DELETE",
      entityType: "ProprietÃ¡rio",
      entityId: id,
      entityLabel: p.nome,
      summary: `ProprietÃ¡rio ${p.nome} removido`,
    });
  }
}

// â”€â”€â”€ ParÃ¢metros (versionado) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function getParametrosHistorico(): ParametrosSistema[] {
  const list = read<ParametrosSistema[]>(K.parametros, []);
  if (list.length === 0) {
    // Seed inicial
    const seed: ParametrosSistema = {
      versao: 1,
      vigenteDesde: now(),
      ...PARAMETROS_DEFAULT,
    };
    write(K.parametros, [seed]);
    return [seed];
  }
  return list;
}

export function getParametrosVigentes(): ParametrosSistema {
  const hist = getParametrosHistorico();
  return hist[hist.length - 1];
}

export function saveParametros(
  novos: Omit<ParametrosSistema, "versao" | "vigenteDesde">,
  motivo: string,
  autor: string = "Gestor"
): ParametrosSistema {
  const hist = getParametrosHistorico();
  const nova: ParametrosSistema = {
    ...novos,
    versao: hist.length + 1,
    vigenteDesde: now(),
    alteradoPor: autor,
    motivo,
  };
  write(K.parametros, [...hist, nova]);
  logAudit({
    actor: autor,
    actorType: "HUMAN",
    action: "CONFIG_CHANGE",
    entityType: "ParÃ¢metros",
    entityId: String(nova.versao),
    entityLabel: `VersÃ£o ${nova.versao}`,
    summary: `ParÃ¢metros atualizados: ${motivo}`,
    diff: { before: hist[hist.length - 1], after: nova },
  });
  return nova;
}
