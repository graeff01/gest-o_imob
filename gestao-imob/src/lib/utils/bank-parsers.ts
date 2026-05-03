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

  if (ext === "xml" || contentLower.includes("<?xml") || contentLower.includes("<lancamento") || contentLower.includes("<transacao")) {
    return parseGenericXML(content);
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
  const lines = normalizeLines(content);

  if (lines.length < 2) {
    return { success: false, transactions: [], bankName: "Caixa Economica Federal", errors: ["Arquivo vazio ou sem dados"] };
  }

  const sep = detectSeparator(lines[0]);
  const rows = lines.map((line) => splitDelimitedLine(line, sep));
  const transactions = parseRows(rows, "Caixa CSV", errors);

  return {
    success: transactions.length > 0,
    transactions,
    bankName: "Caixa Economica Federal",
    accountInfo: "Conta Corrente",
    errors,
  };
}

export function parseGenericXML(content: string): ParseResult {
  const errors: string[] = [];
  const spreadsheetRows = parseXmlSpreadsheetRows(content);
  if (spreadsheetRows.length > 0) {
    const transactions = parseRows(spreadsheetRows, "XML Spreadsheet", errors);
    return {
      success: transactions.length > 0,
      transactions,
      bankName: "Extrato XML",
      accountInfo: "Arquivo XML",
      errors,
    };
  }

  const transactions: ParsedTransaction[] = [];
  const blocks = extractXmlTransactionBlocks(content);
  if (blocks.length === 0) {
    return {
      success: false,
      transactions: [],
      bankName: "Extrato XML",
      accountInfo: "Arquivo XML",
      errors: ["XML reconhecido, mas nao encontrei blocos de lancamento/transacao."],
    };
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const dateRaw = getXmlField(block, ["data", "date", "dtposted", "dt_lancamento", "datalancamento", "datamovimento", "dtmovimento"]);
    const description =
      getXmlField(block, ["historico", "descricao", "description", "memo", "name", "nome", "complemento", "documento"]) ?? "";
    const amountRaw = getXmlField(block, ["valor", "amount", "trnamt", "valorlancamento", "valortransacao"]);
    const debitRaw = getXmlField(block, ["debito", "debit", "saida", "valorDebito"]);
    const creditRaw = getXmlField(block, ["credito", "credit", "entrada", "valorCredito"]);
    const balanceRaw = getXmlField(block, ["saldo", "balance", "balanco"]);
    const docNumber = getXmlField(block, ["doc", "documento", "numero", "fitid", "id"]);
    const typeRaw = getXmlField(block, ["tipo", "natureza", "dc", "sinal"]);

    const date = dateRaw ? parseDate(dateRaw) : null;
    if (!date) {
      errors.push(`XML item ${i + 1}: data invalida ou ausente`);
      continue;
    }

    const amountInfo = parseAmountFromFields(amountRaw, debitRaw, creditRaw, typeRaw);
    if (!amountInfo) {
      errors.push(`XML item ${i + 1}: valor invalido ou ausente`);
      continue;
    }

    const balance = balanceRaw ? parseBRDecimal(decodeXmlEntities(balanceRaw)) : undefined;

    transactions.push({
      date,
      description: decodeXmlEntities(description) || "Lancamento bancario",
      amount: Math.abs(amountInfo.amount),
      balance: balance !== undefined && !Number.isNaN(balance) ? balance : undefined,
      docNumber: docNumber ? decodeXmlEntities(docNumber) : undefined,
      operationType: typeRaw ? normalizeBankText(typeRaw) : detectOperationType(description),
      isCredit: amountInfo.isCredit,
    });
  }

  return {
    success: transactions.length > 0,
    transactions,
    bankName: "Extrato XML",
    accountInfo: "Arquivo XML",
    errors,
  };
}

function parseRows(rows: string[][], source: string, errors: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const firstUsefulRow = rows.findIndex((row) => row.some(Boolean));
  if (firstUsefulRow < 0) return transactions;

  const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeBankText(cell).includes("DATA")));
  const header = headerIndex >= 0 ? rows[headerIndex].map(normalizeBankText) : [];
  const indexes = inferColumnIndexes(header);
  const startIdx = headerIndex >= 0 ? headerIndex + 1 : firstUsefulRow;

  for (let i = startIdx; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length < 2 || cols.every((cell) => !cell.trim())) {
      continue;
    }

    const dateText = cols[indexes.date] ?? "";
    const date = parseDate(dateText);
    if (!date) {
      errors.push(`${source} linha ${i + 1}: data invalida "${dateText}"`);
      continue;
    }

    const description = buildRowDescription(cols, indexes.description);
    const amountInfo = parseAmountFromFields(
      indexes.amount >= 0 ? cols[indexes.amount] : undefined,
      indexes.debit >= 0 ? cols[indexes.debit] : undefined,
      indexes.credit >= 0 ? cols[indexes.credit] : undefined,
      indexes.type >= 0 ? cols[indexes.type] : undefined
    );
    if (!amountInfo) {
      errors.push(`${source} linha ${i + 1}: valor invalido ou ausente`);
      continue;
    }

    const balance = indexes.balance >= 0 && cols[indexes.balance] ? parseBRDecimal(cols[indexes.balance]) : undefined;

    transactions.push({
      date,
      description,
      amount: Math.abs(amountInfo.amount),
      balance: balance !== undefined && !Number.isNaN(balance) ? balance : undefined,
      operationType: detectOperationType(description),
      isCredit: amountInfo.isCredit,
    });
  }

  if (transactions.length === 0 && errors.length === 0) {
    errors.push(`${source}: nao encontrei linhas com data, descricao e valor.`);
  }

  return transactions;
}

function inferColumnIndexes(header: string[]) {
  if (header.length === 0) {
    return { date: 0, description: 1, amount: 2, debit: -1, credit: -1, balance: 3, type: -1 };
  }

  const find = (terms: string[]) => header.findIndex((cell) => terms.some((term) => cell.includes(normalizeBankText(term))));
  const date = find(["DATA", "DT LANCAMENTO", "DATA MOVIMENTO", "DTPOSTED"]);
  const description = find(["HISTORICO", "DESCRICAO", "LANCAMENTO", "MEMO", "NAME", "FAVORECIDO"]);
  const amount = find(["VALOR", "AMOUNT", "TRNAMT"]);
  const debit = find(["DEBITO", "SAIDA", "VALOR DEBITO"]);
  const credit = find(["CREDITO", "ENTRADA", "VALOR CREDITO"]);
  const balance = find(["SALDO", "BALANCE"]);
  const type = find(["TIPO", "NATUREZA", "SINAL", "D C"]);

  return {
    date: date >= 0 ? date : 0,
    description: description >= 0 ? description : 1,
    amount: amount >= 0 ? amount : 2,
    debit,
    credit,
    balance,
    type,
  };
}

function buildRowDescription(cols: string[], descriptionIndex: number): string {
  const description = cols[descriptionIndex]?.trim();
  if (description) return description;

  const fallback = cols.find((cell) => {
    const normalized = normalizeBankText(cell);
    return normalized.length > 2 && !parseDate(cell) && Number.isNaN(parseBRDecimal(cell));
  });

  return fallback?.trim() || "Lancamento bancario";
}

function parseAmountFromFields(
  amountRaw?: string,
  debitRaw?: string,
  creditRaw?: string,
  typeRaw?: string
): { amount: number; isCredit: boolean } | null {
  const credit = creditRaw ? parseBRDecimal(decodeXmlEntities(creditRaw)) : Number.NaN;
  if (!Number.isNaN(credit) && credit !== 0) return { amount: Math.abs(credit), isCredit: true };

  const debit = debitRaw ? parseBRDecimal(decodeXmlEntities(debitRaw)) : Number.NaN;
  if (!Number.isNaN(debit) && debit !== 0) return { amount: -Math.abs(debit), isCredit: false };

  if (!amountRaw) return null;

  const amount = parseBRDecimal(decodeXmlEntities(amountRaw));
  if (Number.isNaN(amount) || amount === 0) return null;

  const type = normalizeBankText(typeRaw ?? "");
  const isDebitByType =
    type.includes("DEBIT") ||
    type === "D" ||
    type.includes("SAIDA") ||
    type.includes("PAGAMENTO") ||
    type.includes("DEBITO");
  const isCreditByType =
    type.includes("CREDIT") ||
    type === "C" ||
    type.includes("ENTRADA") ||
    type.includes("RECEB") ||
    type.includes("CREDITO");

  if (isDebitByType) return { amount: -Math.abs(amount), isCredit: false };
  if (isCreditByType) return { amount: Math.abs(amount), isCredit: true };

  return { amount, isCredit: amount > 0 };
}

function parseXmlSpreadsheetRows(content: string): string[][] {
  if (!/<Workbook[\s>]/i.test(content) && !/<Row[\s>]/i.test(content)) return [];

  const rows: string[][] = [];
  const rowRegex = /<Row\b[^>]*>([\s\S]*?)<\/Row>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(content)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<Cell\b[^>]*>[\s\S]*?<Data\b[^>]*>([\s\S]*?)<\/Data>[\s\S]*?<\/Cell>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(decodeXmlEntities(stripXmlTags(cellMatch[1])).trim());
    }

    if (cells.some(Boolean)) rows.push(cells);
  }

  return rows;
}

function extractXmlTransactionBlocks(content: string): string[] {
  const tags = ["STMTTRN", "lancamento", "transacao", "transaction", "movimento", "item"];
  const blocks: string[] = [];

  for (const tag of tags) {
    const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      blocks.push(match[1]);
    }
    if (blocks.length > 0) break;
  }

  return blocks;
}

function getXmlField(block: string, fields: string[]): string | undefined {
  for (const field of fields) {
    const normalizedField = field.replace(/[-_]/g, "[-_]?");
    const regex = new RegExp(`<${normalizedField}\\b[^>]*>([\\s\\S]*?)<\\/${normalizedField}>`, "i");
    const match = block.match(regex);
    if (match?.[1]) return stripXmlTags(match[1]).trim();
  }
  return undefined;
}

function stripXmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
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
    const name = extractOFXField(block, "NAME") || "";
    const memo = extractOFXField(block, "MEMO") || "";
    const description = [name, memo].filter(Boolean).join(" - ");
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
      description,
      amount: Math.abs(amount),
      docNumber: checkNum || fitId,
      operationType: trnType === "CREDIT" ? "CREDITO" : trnType === "DEBIT" ? "DEBITO" : detectOperationType(description),
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
