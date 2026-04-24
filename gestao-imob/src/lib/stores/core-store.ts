"use client";

/**
 * CORE STORE — Fase A
 *
 * Camada única de tipos + persistência para as entidades estruturais:
 *  - Fornecedor
 *  - Proprietário
 *  - Parâmetros do sistema (versionados)
 *  - Log de auditoria (imutável)
 *  - Fila de exceções (caixa de entrada unificada)
 *
 * Toda persistência é via localStorage com chaves versionadas.
 * Quando o banco for conectado, basta trocar a camada `read`/`write`
 * por chamadas Prisma — os tipos e a API pública permanecem.
 */

// ─── Tipos ────────────────────────────────────────

export interface Fornecedor {
  id: string;
  nome: string;
  cpfCnpj: string;
  categoriaPadrao?: string;
  subcategoriaPadrao?: string;
  /** Confiança acumulada — quantas vezes a classificação bateu */
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
  /** IDs dos imóveis do proprietário */
  imoveisIds: string[];
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Parâmetros do sistema — tudo que antes era hardcoded no código.
 * Cada mudança vira uma nova versão preservando histórico.
 */
export interface ParametrosSistema {
  versao: number;
  vigenteDesde: string;
  // Financeiro
  taxaAdministracao: number; // % padrão (ex: 10)
  taxaAdministracaoReal: number; // % que vira receita real (ex: 3.5)
  percentualRepasseMatriz: number; // % repassado à matriz (ex: 70)
  percentualReceitaAgencia: number; // % que fica na agência (ex: 30)
  // Comissões
  consultorTier1Max: number; // até N locações = tier 1
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
  // Régua de cobrança (dias após vencimento)
  reguaAviso1: number;
  reguaAviso2: number;
  reguaAviso3: number;
  reguaJuridico: number;
  // Fiscais
  prazoEmissaoNF: number; // dia do mês limite
  indiceReajustePadrao: "IGPM" | "IPCA";
  // IA
  scoreConfiancaAutoAprovacao: number; // >= este valor, aprova sozinho
  /** Autor da alteração */
  alteradoPor?: string;
  /** Motivo da alteração */
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
 * Log de auditoria — imutável, append-only.
 * Toda ação relevante (humana ou IA) deve gerar um registro.
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
  actor: string; // "Sistema IA" | nome do usuário
  actorType: "HUMAN" | "AI" | "SYSTEM";
  action: AuditAction;
  entityType: string; // "Fornecedor" | "Contrato" | "Parametros" | ...
  entityId?: string;
  entityLabel?: string;
  /** Descrição curta da mudança */
  summary: string;
  /** Score de confiança da IA (quando aplicável) */
  confidence?: number;
  /** Dados antes/depois (diff) */
  diff?: { before?: unknown; after?: unknown };
}

/**
 * Fila de exceções — tudo que exige atenção humana.
 * Alimentada por IA e por validações cruzadas.
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
  /** Módulo de origem: "financeiro" | "contratos" | "nf" | ... */
  source: string;
  entityType?: string;
  entityId?: string;
  /** Valores relevantes pra contexto */
  meta?: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

// ─── Chaves de storage ────────────────────────────

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
  { id: "forn-001", nome: "Auxiliadora Predial Franquias Ltda", cpfCnpj: "00000000000191", categoriaPadrao: "Royalties Franquia", subcategoriaPadrao: "Royalties mensais", confiancaClassificacao: 98, totalMovimentado: 56400, quantidadeLancamentos: 12, observacoes: "Pagamento mensal até dia 5", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "forn-002", nome: "Claro Empresas", cpfCnpj: "40432544000147", categoriaPadrao: "Contas de Consumo", subcategoriaPadrao: "Telefone/Internet", confiancaClassificacao: 95, totalMovimentado: 5880, quantidadeLancamentos: 12, observacoes: "Plano fibra escritório", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "forn-003", nome: "CEEE Equatorial", cpfCnpj: "08467115000100", categoriaPadrao: "Contas de Consumo", subcategoriaPadrao: "Luz/Energia", confiancaClassificacao: 97, totalMovimentado: 10164, quantidadeLancamentos: 12, observacoes: "", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "forn-004", nome: "Agência Digital RS", cpfCnpj: "34567890000111", categoriaPadrao: "Marketing", subcategoriaPadrao: "Marketing digital", confiancaClassificacao: 85, totalMovimentado: 28800, quantidadeLancamentos: 12, observacoes: "Gestão Instagram + ZAP Imóveis", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "forn-005", nome: "PipeImob Tecnologia", cpfCnpj: "23456789000122", categoriaPadrao: "Software/Sistemas", subcategoriaPadrao: "CRM imobiliário", confiancaClassificacao: 99, totalMovimentado: 5880, quantidadeLancamentos: 12, observacoes: "Licença mensal do CRM", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "forn-006", nome: "João Encanador ME", cpfCnpj: "12345678000133", categoriaPadrao: "Manutenção", subcategoriaPadrao: "Hidráulica", confiancaClassificacao: 70, totalMovimentado: 2340, quantidadeLancamentos: 6, observacoes: "Prestador de serviço hidráulico", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "forn-007", nome: "Prefeitura Municipal de Porto Alegre", cpfCnpj: "92963560000160", categoriaPadrao: "Impostos e Tributos", subcategoriaPadrao: "ISSQN", confiancaClassificacao: 99, totalMovimentado: 28080, quantidadeLancamentos: 12, observacoes: "ISSQN mensal", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "forn-008", nome: "Pintura Pro Ltda", cpfCnpj: "45678901000144", categoriaPadrao: "Manutenção", subcategoriaPadrao: "Pintura", confiancaClassificacao: 60, totalMovimentado: 9000, quantidadeLancamentos: 2, observacoes: "", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
];

const SEED_PROPRIETARIOS: Proprietario[] = [
  { id: "prop-own-001", nome: "Maria Aparecida Lima", cpfCnpj: "98765432100", telefone: "(51) 99234-5678", email: "maria.lima@gmail.com", pix: "maria.lima@gmail.com", banco: "Itaú", agencia: "1234", conta: "56789-0", imoveisIds: ["prop-001"], observacoes: "Proprietária do Ap 301 Av. Independência", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "prop-own-002", nome: "Carlos Eduardo Souza", cpfCnpj: "11122233344", telefone: "(51) 98123-4567", email: "carlos.souza@outlook.com", pix: "98765-4321", banco: "Bradesco", agencia: "2345", conta: "67890-1", imoveisIds: ["prop-002", "prop-007"], observacoes: "", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "prop-own-003", nome: "Roberto Almeida Costa", cpfCnpj: "44433322211", telefone: "(51) 99345-6789", email: "roberto.costa@gmail.com", pix: "roberto.costa@gmail.com", banco: "Banco do Brasil", agencia: "3456", conta: "78901-2", imoveisIds: ["prop-003", "prop-008"], observacoes: "", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "prop-own-004", nome: "Lucia Hoffmann", cpfCnpj: "21221212212", telefone: "(51) 98456-7890", email: "lucia.hoffmann@terra.com.br", pix: "21221212212", banco: "Caixa Econômica", agencia: "4567", conta: "89012-3", imoveisIds: ["prop-004", "prop-010"], observacoes: "Prefere contato por e-mail", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "prop-own-005", nome: "Francisco Antônio Moreira", cpfCnpj: "55544433322", telefone: "(51) 99567-8901", email: undefined, pix: "55544433322", banco: "Santander", agencia: "5678", conta: "90123-4", imoveisIds: ["prop-005", "prop-011"], observacoes: "Sem e-mail — contato somente por WhatsApp", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
  { id: "prop-own-006", nome: "Imobiliária Planalto Ltda", cpfCnpj: "89012345000167", telefone: "(51) 3232-1234", email: "contato@planalto.imob.br", pix: "contato@planalto.imob.br", banco: "Itaú", agencia: "6789", conta: "01234-5", imoveisIds: ["prop-006", "prop-012"], observacoes: "PJ — emite NF para repasse", criadoEm: "2025-01-01T00:00:00.000Z", atualizadoEm: "2025-01-01T00:00:00.000Z" },
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

// ─── Helpers internos ─────────────────────────────

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

// ─── Audit ────────────────────────────────────────

export function logAudit(entry: Omit<AuditEntry, "id" | "timestamp">) {
  const log = read<AuditEntry[]>(K.audit, []);
  const full: AuditEntry = { id: uuid(), timestamp: now(), ...entry };
  // Append-only, limita a 10k entradas para não estourar storage
  const next = [full, ...log].slice(0, 10000);
  write(K.audit, next);
  return full;
}

export function getAuditLog(): AuditEntry[] {
  return read<AuditEntry[]>(K.audit, []);
}

// ─── Exceptions ───────────────────────────────────

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

// ─── Fornecedores ─────────────────────────────────

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

// ─── Proprietários ────────────────────────────────

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
      entityType: "Proprietário",
      entityId: p.id,
      entityLabel: p.nome,
      summary: `Proprietário ${p.nome} atualizado`,
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
    entityType: "Proprietário",
    entityId: novo.id,
    entityLabel: novo.nome,
    summary: `Proprietário ${novo.nome} cadastrado`,
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
      entityType: "Proprietário",
      entityId: id,
      entityLabel: p.nome,
      summary: `Proprietário ${p.nome} removido`,
    });
  }
}

// ─── Parâmetros (versionado) ──────────────────────

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
    entityType: "Parâmetros",
    entityId: String(nova.versao),
    entityLabel: `Versão ${nova.versao}`,
    summary: `Parâmetros atualizados: ${motivo}`,
    diff: { before: hist[hist.length - 1], after: nova },
  });
  return nova;
}
