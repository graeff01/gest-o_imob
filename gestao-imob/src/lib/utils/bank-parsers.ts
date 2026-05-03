/**
 * Parsers e categorizacao deterministica para extratos bancarios.
 * Suporta Caixa CSV/OFX e CSV do Pipeimob.
 */

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // sempre positivo; isCredit define entrada/saida
  balance?: number;
  docNumber?: string;
  operationType: string;
  isCredit: boolean;
}

export interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  bankName: string;
  accountInfo?: string;
  errors: string[];
}

export const CATEGORIES = {
  "Aluguel Recebido": { color: "bg-green-100 text-green-800", type: "receita" },
  "Comissao Recebida": { color: "bg-emerald-100 text-emerald-800", type: "receita" },
  "Repasse Recebido": { color: "bg-teal-100 text-teal-800", type: "receita" },
  "Outras Receitas": { color: "bg-lime-100 text-lime-800", type: "receita" },
  "Mercado / Copa": { color: "bg-amber-100 text-amber-800", type: "despesa" },
  "Farmacia": { color: "bg-rose-100 text-rose-800", type: "despesa" },
  "Ferragem / Material": { color: "bg-zinc-100 text-zinc-800", type: "despesa" },
  "Alimentacao": { color: "bg-orange-100 text-orange-800", type: "despesa" },
  "Folha / Comissoes": { color: "bg-blue-100 text-blue-800", type: "despesa" },
  "Royalties Franquia": { color: "bg-violet-100 text-violet-800", type: "despesa" },
  "Contas de Consumo": { color: "bg-amber-100 text-amber-800", type: "despesa" },
  "Aluguel Escritorio": { color: "bg-orange-100 text-orange-800", type: "despesa" },
  "Condominio": { color: "bg-yellow-100 text-yellow-800", type: "despesa" },
  "IPTU / Impostos": { color: "bg-red-100 text-red-800", type: "despesa" },
  "Tarifas Bancarias": { color: "bg-slate-100 text-slate-800", type: "despesa" },
  "Marketing / Publicidade": { color: "bg-pink-100 text-pink-800", type: "despesa" },
  "Manutencao / Reparos": { color: "bg-cyan-100 text-cyan-800", type: "despesa" },
  "Material Escritorio": { color: "bg-indigo-100 text-indigo-800", type: "despesa" },
  "Software / Sistemas": { color: "bg-purple-100 text-purple-800", type: "despesa" },
  "Seguros": { color: "bg-sky-100 text-sky-800", type: "despesa" },
  "Contabilidade / Juridico": { color: "bg-fuchsia-100 text-fuchsia-800", type: "despesa" },
  "Transporte / Combustivel": { color: "bg-stone-100 text-stone-800", type: "despesa" },
  "Outros": { color: "bg-gray-100 text-gray-800", type: "despesa" },
} as const;

export type CategoryName = keyof typeof CATEGORIES;
export type BankTransactionKind = "receita" | "despesa";

export interface TransactionCategorySuggestion {
  category: CategoryName;
  kind: BankTransactionKind;
  expenseCategoryNames: string[];
  revenueCategory:
    | "INTERMEDIACAO"
    | "AGENCIAMENTO"
    | "CAMPANHA_SUCESSO"
    | "CAMPANHA_CAPTACAO"
    | "NFSE_ALUGUEL"
    | "ROYALTY"
    | "OUTRO";
  department: "VENDA" | "LOCACAO" | "ADMIN" | "AMBOS";
  paymentMethod?: "PIX" | "BOLETO" | "CARTAO" | "DINHEIRO" | "DEBITO_AUTOMATICO" | "TRANSFERENCIA";
  supplier?: string;
  confidence: number;
  matchedRule: string;
}

interface RuleDefinition {
  id: string;
  category: CategoryName;
  kind: BankTransactionKind;
  any: string[];
  all?: string[];
  not?: string[];
  expenseCategoryNames?: string[];
  revenueCategory?: TransactionCategorySuggestion["revenueCategory"];
  department?: TransactionCategorySuggestion["department"];
  paymentMethod?: TransactionCategorySuggestion["paymentMethod"];
  confidence?: number;
}

const SMART_RULES: RuleDefinition[] = [
  {
    id: "receita-aluguel",
    category: "Aluguel Recebido",
    kind: "receita",
    any: ["ALUGUEL", "ALUG", "LOCACAO", "TAXA ADMINISTRACAO", "TX ADMIN"],
    not: ["PAGAMENTO", "PAGTO", "DEBITO"],
    revenueCategory: "NFSE_ALUGUEL",
    department: "LOCACAO",
    paymentMethod: "PIX",
    confidence: 92,
  },
  {
    id: "receita-repasse",
    category: "Repasse Recebido",
    kind: "receita",
    any: ["PIPEIMOB", "REPASSE", "FIDC", "LIQUIDACAO PIPE"],
    revenueCategory: "INTERMEDIACAO",
    department: "LOCACAO",
    paymentMethod: "TRANSFERENCIA",
    confidence: 92,
  },
  {
    id: "receita-comissao",
    category: "Comissao Recebida",
    kind: "receita",
    any: ["COMISSAO", "INTERMEDIACAO", "AGENCIAMENTO"],
    revenueCategory: "INTERMEDIACAO",
    department: "AMBOS",
    confidence: 85,
  },
  {
    id: "mercado-copa",
    category: "Mercado / Copa",
    kind: "despesa",
    any: [
      "MERCADO", "SUPERMERCADO", "SUPER MERCADO", "HIPERMERCADO", "ATACADAO", "ASSAI",
      "ZAFFARI", "CARREFOUR", "BIG ", "NACIONAL", "DIA BRASIL", "MAXXI", "RISSUL",
      "UNISUPER", "COSTA ATACADO", "FORT ATACADISTA", "MACROMIX",
    ],
    expenseCategoryNames: ["Copa/Cozinha", "Mantimentos/Cafe", "Alimentacao/Copa", "Material"],
    department: "AMBOS",
    paymentMethod: "CARTAO",
    confidence: 92,
  },
  {
    id: "farmacia",
    category: "Farmacia",
    kind: "despesa",
    any: ["FARMACIA", "DROGARIA", "DROGA", "PANVEL", "DROGASIL", "RAIA", "SAO JOAO", "PACHECO", "ULTRAFARMA", "NISSEI", "PAGUE MENOS"],
    expenseCategoryNames: ["Farmacia", "Material", "Outros Operacionais Venda", "Mantimentos/Cafe"],
    department: "AMBOS",
    paymentMethod: "CARTAO",
    confidence: 90,
  },
  {
    id: "ferragem-manutencao",
    category: "Ferragem / Material",
    kind: "despesa",
    any: ["FERRAGEM", "FERRAGENS", "MATERIAL CONSTRUCAO", "CONSTRUCAO", "LEROY", "TELHANORTE", "TUMELERO", "CASSOL", "FERRAMENTA", "PARAFUSO", "ELETRICA", "HIDRAULICA"],
    expenseCategoryNames: ["Ferragens/Material de Construcao", "Ferragens e Utilidades", "Manutencao Geral", "Manutencao Eletrica", "Manutencao Hidraulica"],
    department: "AMBOS",
    paymentMethod: "CARTAO",
    confidence: 91,
  },
  {
    id: "alimentacao",
    category: "Alimentacao",
    kind: "despesa",
    any: ["RESTAURANTE", "LANCH", "PADARIA", "CAFE", "IFOOD", "AIQFOME", "MCDONALD", "BURGER KING", "SUBWAY", "PIZZARIA", "CHURRASCARIA"],
    expenseCategoryNames: ["Alimentacao/Copa", "Copa/Cozinha", "Mantimentos/Cafe", "VA (Vale Alimentacao) Locacao", "VA (Vale Alimentacao) Venda"],
    department: "AMBOS",
    paymentMethod: "CARTAO",
    confidence: 82,
  },
  {
    id: "tarifas",
    category: "Tarifas Bancarias",
    kind: "despesa",
    any: ["TARIFA", "TAR ", "CESTA", "MANUT CONTA", "ANUIDADE", "IOF", "JUROS", "ENCARGOS", "TED TARIFA", "PIX TARIFA"],
    expenseCategoryNames: ["TAR PIX", "Tarifa Boleto", "Tarifa TED/DOC", "Tarifa Cesta", "IOF", "Juros Bancarios", "Outras Tarifas"],
    department: "AMBOS",
    confidence: 94,
  },
  {
    id: "transporte",
    category: "Transporte / Combustivel",
    kind: "despesa",
    any: ["UBER", "99 ", "99APP", "CABIFY", "POSTO", "COMBUSTIVEL", "GASOLINA", "IPIRANGA", "SHELL", "RAIZEN", "ESTACIONAM", "PEDAGIO"],
    expenseCategoryNames: ["Uber/Transporte", "VT (Vale Transporte) Locacao", "VT (Vale Transporte) Venda", "Outros Operacionais Venda"],
    department: "AMBOS",
    paymentMethod: "CARTAO",
    confidence: 88,
  },
  {
    id: "marketing",
    category: "Marketing / Publicidade",
    kind: "despesa",
    any: ["GOOGLE", "META ADS", "FACEBOOK", "INSTAGRAM", "PUBLICIDADE", "ANUNCIO", "OLX", "ZAP IMOV", "MARKETING"],
    expenseCategoryNames: ["Google Mensal", "Google Impulsionamento", "Facebook Impulsionamento", "Instagram Impulsionamento", "Associacao de Marketing"],
    department: "AMBOS",
    paymentMethod: "CARTAO",
    confidence: 90,
  },
  {
    id: "software",
    category: "Software / Sistemas",
    kind: "despesa",
    any: ["SOFTWARE", "SISTEMA", "ASSINATURA", "MICROSOFT", "ADOBE", "ZOOM", "SUPERLOGICA", "JETIMOB", "IMOVIEW", "ARBO", "CHECK ON", "CHECK-ON", "PROCOB"],
    expenseCategoryNames: ["Assinatura Digital/Aplicativo", "CHECK-ON (software)", "Procob (sistema de credito)", "Software Locacao"],
    department: "AMBOS",
    paymentMethod: "CARTAO",
    confidence: 89,
  },
  {
    id: "contas-consumo",
    category: "Contas de Consumo",
    kind: "despesa",
    any: ["ENERGIA", "LUZ", "CEEE", "RGE", "CPFL", "AGUA", "DMAE", "CORSAN", "TELEFONE", "INTERNET", "VIVO", "CLARO", "TIM ", "OI ", "GAS", "SULGAS"],
    expenseCategoryNames: ["Energia Eletrica", "Informatica/Internet", "Telefone Fixo", "Celular Claro", "Celular Vivo", "Celular TIM", "Agua Mineral"],
    department: "AMBOS",
    paymentMethod: "BOLETO",
    confidence: 90,
  },
  {
    id: "impostos",
    category: "IPTU / Impostos",
    kind: "despesa",
    any: ["IPTU", "ISS", "DARF", "DAS ", "SIMPLES", "IRPJ", "CSLL", "PIS", "COFINS", "IMPOSTO"],
    expenseCategoryNames: ["IPTU", "ISS", "Simples Nacional", "IRPJ", "CSLL", "PIS", "COFINS", "Outros Impostos"],
    department: "AMBOS",
    paymentMethod: "BOLETO",
    confidence: 92,
  },
  {
    id: "folha",
    category: "Folha / Comissoes",
    kind: "despesa",
    any: ["SALARIO", "FOLHA", "FGTS", "INSS", "FERIAS", "RESCISAO", "PRO LABORE", "VALE TRANSPORTE", "VALE REFEICAO", "COMISSAO"],
    expenseCategoryNames: ["Salarios Locacao", "Salarios Venda", "FGTS Locacao", "FGTS Venda", "GPS/INSS Locacao", "GPS/INSS Venda", "Pro-labore Locacao", "Pro-labore Venda"],
    department: "AMBOS",
    paymentMethod: "TRANSFERENCIA",
    confidence: 87,
  },
  {
    id: "gastos-espaco",
    category: "Aluguel Escritorio",
    kind: "despesa",
    any: ["ALUGUEL", "CONDOMINIO", "IPTU ESCRITORIO", "SEGURO ESCRITORIO", "REFORMA"],
    not: ["RECEB", "CREDITO"],
    expenseCategoryNames: ["Aluguel Escritorio", "Condominio Escritorio", "IPTU Escritorio", "Seguro Escritorio", "Reforma/Obra"],
    department: "AMBOS",
    paymentMethod: "BOLETO",
    confidence: 84,
  },
  {
    id: "contabilidade-juridico",
    category: "Contabilidade / Juridico",
    kind: "despesa",
    any: ["CONTABIL", "CONTADOR", "ADVOGAD", "JURIDIC", "HONORAR", "CARTORIO", "CERTIDAO", "CERTIDOES"],
    expenseCategoryNames: ["Certidoes/Procuracao", "Cartoes de Visita", "Outros Operacionais Venda"],
    department: "AMBOS",
    paymentMethod: "TRANSFERENCIA",
    confidence: 82,
  },
];

export type BankSource = "caixa_csv" | "caixa_ofx" | "pipeimob";

export function detectAndParse(content: string, fileName: string): ParseResult {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const contentLower = content.toLowerCase();

  if (ext === "ofx" || ext === "qfx" || contentLower.includes("<ofx>") || contentLower.includes("ofxheader")) {
    return parseCaixaOFX(content);
  }

  if (
    fileName.toLowerCase().includes("pipeimob") ||
    fileName.toLowerCase().includes("pipe") ||
    contentLower.includes("pipeimob") ||
    contentLower.includes("contrato")
  ) {
    return parsePipeimobCSV(content);
  }

  return parseCaixaCSV(content);
}

export function parseCaixaCSV(content: string): ParseResult {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];
  const lines = normalizeLines(content);

  if (lines.length < 2) {
    return { success: false, transactions: [], bankName: "Caixa Economica Federal", errors: ["Arquivo vazio ou sem dados"] };
  }

  const sep = detectSeparator(lines[0]);
  const startIdx = normalizeBankText(lines[0]).includes("DATA") ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitDelimitedLine(lines[i], sep);
    if (cols.length < 3) {
      errors.push(`Linha ${i + 1}: formato invalido (${cols.length} colunas)`);
      continue;
    }

    const date = parseDate(cols[0]);
    if (!date) {
      errors.push(`Linha ${i + 1}: data invalida "${cols[0]}"`);
      continue;
    }

    const amount = parseBRDecimal(cols[2] || "0");
    if (Number.isNaN(amount)) {
      errors.push(`Linha ${i + 1}: valor invalido "${cols[2]}"`);
      continue;
    }

    const balance = cols[3] ? parseBRDecimal(cols[3]) : undefined;
    const description = cols[1] || "";

    transactions.push({
      date,
      description,
      amount: Math.abs(amount),
      balance: balance !== undefined && !Number.isNaN(balance) ? balance : undefined,
      operationType: detectOperationType(description),
      isCredit: amount >= 0,
    });
  }

  return {
    success: transactions.length > 0,
    transactions,
    bankName: "Caixa Economica Federal",
    accountInfo: "Conta Corrente",
    errors,
  };
}

export function parseCaixaOFX(content: string): ParseResult {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];
  const transRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/STMTTRN>)/gi;
  let match: RegExpExecArray | null;

  while ((match = transRegex.exec(content)) !== null) {
    const block = match[1];
    const trnType = extractOFXField(block, "TRNTYPE") || "OTHER";
    const dateRaw = extractOFXField(block, "DTPOSTED") || "";
    const amountStr = extractOFXField(block, "TRNAMT") || "0";
    const memo = extractOFXField(block, "MEMO") || extractOFXField(block, "NAME") || "";
    const fitId = extractOFXField(block, "FITID") || "";
    const checkNum = extractOFXField(block, "CHECKNUM");

    if (dateRaw.length < 8) {
      errors.push(`Transacao com data invalida: "${dateRaw}"`);
      continue;
    }

    const amount = Number.parseFloat(amountStr.replace(",", "."));
    if (Number.isNaN(amount)) {
      errors.push(`Transacao com valor invalido: "${amountStr}"`);
      continue;
    }

    transactions.push({
      date: `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`,
      description: memo,
      amount: Math.abs(amount),
      docNumber: checkNum || fitId,
      operationType: trnType === "CREDIT" ? "CREDITO" : trnType === "DEBIT" ? "DEBITO" : detectOperationType(memo),
      isCredit: amount > 0,
    });
  }

  const acctId = extractOFXField(content, "ACCTID") || "";
  const balAmtStr = extractOFXField(content, "BALAMT");
  if (balAmtStr && transactions.length > 0) {
    transactions[transactions.length - 1].balance = Number.parseFloat(balAmtStr.replace(",", "."));
  }

  return {
    success: transactions.length > 0,
    transactions,
    bankName: "Caixa Economica Federal",
    accountInfo: acctId ? `Ag/Conta: ${acctId}` : undefined,
    errors,
  };
}

export function parsePipeimobCSV(content: string): ParseResult {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];
  const lines = normalizeLines(content);

  if (lines.length < 2) {
    return { success: false, transactions: [], bankName: "Pipeimob", errors: ["Arquivo vazio ou sem dados"] };
  }

  const sep = detectSeparator(lines[0]);
  const startIdx = normalizeBankText(lines[0]).includes("DATA") ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitDelimitedLine(lines[i], sep);
    if (cols.length < 4) {
      errors.push(`Linha ${i + 1}: formato invalido (${cols.length} colunas)`);
      continue;
    }

    const date = parseDate(cols[0]);
    if (!date) {
      errors.push(`Linha ${i + 1}: data invalida "${cols[0]}"`);
      continue;
    }

    let amount = parseBRDecimal(cols[3] || "0");
    if (Number.isNaN(amount)) amount = Number.parseFloat(cols[3] || "0");
    if (Number.isNaN(amount)) {
      errors.push(`Linha ${i + 1}: valor invalido "${cols[3]}"`);
      continue;
    }

    const tipo = normalizeBankText(cols[2] || "");
    const contrato = cols[4];
    const description = contrato ? `${cols[1] || ""} [${contrato}]` : cols[1] || "";

    transactions.push({
      date,
      description,
      amount: Math.abs(amount),
      docNumber: contrato,
      operationType: tipo || detectOperationType(description),
      isCredit: tipo.includes("CREDIT") || tipo.includes("ENTRADA") || amount > 0,
    });
  }

  return {
    success: transactions.length > 0,
    transactions,
    bankName: "Pipeimob",
    accountInfo: "Plataforma Digital",
    errors,
  };
}

export function suggestCategory(description: string): CategoryName {
  return suggestTransactionClassification(description).category;
}

export function suggestTransactionClassification(
  description: string,
  isCredit?: boolean
): TransactionCategorySuggestion {
  const normalized = normalizeBankText(description);
  const kind: BankTransactionKind = isCredit ? "receita" : "despesa";
  const candidates = SMART_RULES.filter((rule) => isCredit === undefined || rule.kind === kind);

  for (const rule of candidates) {
    if (matchesRule(normalized, rule)) {
      return {
        category: rule.category,
        kind: rule.kind,
        expenseCategoryNames: rule.expenseCategoryNames ?? ["Outros Operacionais Venda", "Outros Operacionais Locacao"],
        revenueCategory: rule.revenueCategory ?? "OUTRO",
        department: rule.department ?? "AMBOS",
        paymentMethod: rule.paymentMethod ?? detectPaymentMethod(normalized),
        supplier: extractLikelySupplier(description),
        confidence: rule.confidence ?? 80,
        matchedRule: rule.id,
      };
    }
  }

  if (isCredit) {
    return {
      category: "Outras Receitas",
      kind: "receita",
      expenseCategoryNames: [],
      revenueCategory: "OUTRO",
      department: "AMBOS",
      paymentMethod: detectPaymentMethod(normalized),
      supplier: extractLikelySupplier(description),
      confidence: 55,
      matchedRule: "fallback-receita",
    };
  }

  return {
    category: "Outros",
    kind: "despesa",
    expenseCategoryNames: ["Outros Operacionais Venda", "Outros Operacionais Locacao", "Outras Manutencoes"],
    revenueCategory: "OUTRO",
    department: "AMBOS",
    paymentMethod: detectPaymentMethod(normalized),
    supplier: extractLikelySupplier(description),
    confidence: 35,
    matchedRule: "fallback-despesa",
  };
}

export function normalizeBankText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeLines(content: string): string[] {
  return content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function detectSeparator(header: string): string {
  if (header.includes(";")) return ";";
  if (header.includes("\t")) return "\t";
  return ",";
}

function splitDelimitedLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }
    if (char === sep && !insideQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  result.push(current.trim());
  return result.map((item) => item.replace(/^"|"$/g, "").trim());
}

function parseDate(value: string): string | null {
  const clean = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const br = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }

  const compact = clean.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

  return null;
}

function parseBRDecimal(value: string): number {
  let clean = value.replace(/\s/g, "").replace(/R\$/gi, "").trim();
  const creditDebitSuffix = clean.match(/^(.+?)([CD])$/i);
  let suffixSign = 1;
  if (creditDebitSuffix) {
    clean = creditDebitSuffix[1];
    suffixSign = creditDebitSuffix[2].toUpperCase() === "D" ? -1 : 1;
  }

  if (clean.includes(",") && clean.includes(".")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  }

  const parsed = Number.parseFloat(clean);
  return Number.isNaN(parsed) ? Number.NaN : parsed * suffixSign;
}

function extractOFXField(content: string, field: string): string | undefined {
  const regex = new RegExp(`<${field}>([^<\\n\\r]+)`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : undefined;
}

function detectOperationType(description: string): string {
  const desc = normalizeBankText(description);
  if (desc.includes("PIX")) return "PIX";
  if (desc.includes("TED")) return "TED";
  if (desc.includes("DOC")) return "DOC";
  if (desc.includes("BOLETO") || desc.includes("TITULO")) return "BOLETO";
  if (desc.includes("TARIFA") || desc.includes("TAR ")) return "TARIFA";
  if (desc.includes("IOF")) return "IOF";
  if (desc.includes("SAQUE")) return "SAQUE";
  if (desc.includes("DEPOSITO")) return "DEPOSITO";
  if (desc.includes("TRANSF")) return "TRANSFERENCIA";
  if (desc.includes("ALUGUEL") || desc.includes("LOCACAO")) return "ALUGUEL";
  if (desc.includes("COMISSAO")) return "COMISSAO";
  if (desc.includes("COMPRA") || desc.includes("CARTAO")) return "COMPRA";
  return "OUTROS";
}

function matchesRule(normalizedDescription: string, rule: RuleDefinition): boolean {
  if (!rule.any.some((term) => normalizedDescription.includes(normalizeBankText(term)))) return false;
  if (rule.all && !rule.all.every((term) => normalizedDescription.includes(normalizeBankText(term)))) return false;
  return !(rule.not?.some((term) => normalizedDescription.includes(normalizeBankText(term))) ?? false);
}

function detectPaymentMethod(normalizedDescription: string): TransactionCategorySuggestion["paymentMethod"] {
  if (normalizedDescription.includes("PIX")) return "PIX";
  if (normalizedDescription.includes("BOLETO") || normalizedDescription.includes("TITULO")) return "BOLETO";
  if (normalizedDescription.includes("CARTAO") || normalizedDescription.includes("CREDITO") || normalizedDescription.includes("DEBITO")) return "CARTAO";
  if (normalizedDescription.includes("TED") || normalizedDescription.includes("DOC") || normalizedDescription.includes("TRANSF")) return "TRANSFERENCIA";
  if (normalizedDescription.includes("DEB AUT") || normalizedDescription.includes("DEBITO AUTOMATICO")) return "DEBITO_AUTOMATICO";
  return undefined;
}

function extractLikelySupplier(description: string): string | undefined {
  const cleaned = description
    .replace(/\b(PIX|TED|DOC|PAGTO|PAGAMENTO|COMPRA|CARTAO|DEBITO|CREDITO|BOLETO|TITULO|TRANSF|RECEBIDO|ENVIADO)\b/gi, " ")
    .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, " ")
    .replace(/[0-9.,-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length >= 3 ? cleaned.slice(0, 80) : undefined;
}
