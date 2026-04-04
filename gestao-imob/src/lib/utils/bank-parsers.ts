/**
 * Parsers para extratos bancários
 * - Caixa Econômica Federal (CSV e OFX)
 * - Pipeimob (CSV plataforma)
 */

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positivo = crédito, negativo = débito
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

// ═══════════════════════════════════════════
// CAIXA ECONÔMICA - CSV
// ═══════════════════════════════════════════
// Formato típico:
// Data;Histórico;Valor;Saldo
// 01/03/2026;PIX RECEBIDO - FULANO;1.500,00;12.345,67
// 02/03/2026;PAGTO TITULO;-800,00;11.545,67

export function parseCaixaCSV(content: string): ParseResult {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];

  const lines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { success: false, transactions: [], bankName: "Caixa Econômica Federal", errors: ["Arquivo vazio ou sem dados"] };
  }

  // Detectar separador (ponto e vírgula ou tab)
  const sep = lines[0].includes(";") ? ";" : "\t";

  // Pular header
  const startIdx = lines[0].toLowerCase().includes("data") ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 3) {
      errors.push(`Linha ${i + 1}: formato inválido (${cols.length} colunas)`);
      continue;
    }

    const dateStr = cols[0];
    const description = cols[1] || "";
    const valorStr = cols[2] || "0";
    const saldoStr = cols.length > 3 ? cols[3] : undefined;

    // Parse data DD/MM/YYYY -> YYYY-MM-DD
    const dateParts = dateStr.split("/");
    if (dateParts.length !== 3) {
      errors.push(`Linha ${i + 1}: data inválida "${dateStr}"`);
      continue;
    }
    const isoDate = `${dateParts[2]}-${dateParts[1].padStart(2, "0")}-${dateParts[0].padStart(2, "0")}`;

    // Parse valor BR (1.234,56 -> 1234.56)
    const amount = parseBRDecimal(valorStr);
    if (isNaN(amount)) {
      errors.push(`Linha ${i + 1}: valor inválido "${valorStr}"`);
      continue;
    }

    const balance = saldoStr ? parseBRDecimal(saldoStr) : undefined;

    // Detectar tipo de operação pelo histórico
    const opType = detectOperationType(description);

    transactions.push({
      date: isoDate,
      description: description,
      amount: Math.abs(amount),
      balance: balance !== undefined && !isNaN(balance) ? balance : undefined,
      operationType: opType,
      isCredit: amount >= 0,
    });
  }

  return {
    success: transactions.length > 0,
    transactions,
    bankName: "Caixa Econômica Federal",
    accountInfo: "Conta Corrente",
    errors,
  };
}

// ═══════════════════════════════════════════
// CAIXA ECONÔMICA - OFX
// ═══════════════════════════════════════════
// Formato OFX/QFX usado por bancos brasileiros

export function parseCaixaOFX(content: string): ParseResult {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];

  // Extrair transações do bloco STMTTRN
  const transRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = transRegex.exec(content)) !== null) {
    const block = match[1];

    const trnType = extractOFXField(block, "TRNTYPE") || "OTHER";
    const dateRaw = extractOFXField(block, "DTPOSTED") || "";
    const amountStr = extractOFXField(block, "TRNAMT") || "0";
    const memo = extractOFXField(block, "MEMO") || extractOFXField(block, "NAME") || "";
    const fitId = extractOFXField(block, "FITID") || "";
    const checkNum = extractOFXField(block, "CHECKNUM");

    // Parse data YYYYMMDD -> YYYY-MM-DD
    if (dateRaw.length < 8) {
      errors.push(`Transação com data inválida: "${dateRaw}"`);
      continue;
    }
    const isoDate = `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`;

    const amount = parseFloat(amountStr.replace(",", "."));
    if (isNaN(amount)) {
      errors.push(`Transação com valor inválido: "${amountStr}"`);
      continue;
    }

    transactions.push({
      date: isoDate,
      description: memo,
      amount: Math.abs(amount),
      docNumber: checkNum || fitId,
      operationType: trnType === "CREDIT" ? "CREDITO" : trnType === "DEBIT" ? "DEBITO" : detectOperationType(memo),
      isCredit: amount > 0,
    });
  }

  // Extrair info da conta
  const acctId = extractOFXField(content, "ACCTID") || "";
  const bankId = extractOFXField(content, "BANKID") || "104";

  // Saldo final
  const balAmtStr = extractOFXField(content, "BALAMT");
  if (balAmtStr && transactions.length > 0) {
    const lastTx = transactions[transactions.length - 1];
    lastTx.balance = parseFloat(balAmtStr.replace(",", "."));
  }

  return {
    success: transactions.length > 0,
    transactions,
    bankName: "Caixa Econômica Federal",
    accountInfo: acctId ? `Ag/Conta: ${acctId}` : undefined,
    errors,
  };
}

// ═══════════════════════════════════════════
// PIPEIMOB (CSV da plataforma)
// ═══════════════════════════════════════════
// Formato típico:
// Data,Descrição,Tipo,Valor,Contrato
// 01/03/2026,Aluguel Recebido - MV-2025-0001,CREDITO,2500.00,MV-2025-0001

export function parsePipeimobCSV(content: string): ParseResult {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];

  const lines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { success: false, transactions: [], bankName: "Pipeimob", errors: ["Arquivo vazio ou sem dados"] };
  }

  const sep = lines[0].includes(";") ? ";" : ",";
  const startIdx = lines[0].toLowerCase().includes("data") ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 4) {
      errors.push(`Linha ${i + 1}: formato inválido (${cols.length} colunas)`);
      continue;
    }

    const dateStr = cols[0];
    const description = cols[1] || "";
    const tipo = (cols[2] || "").toUpperCase();
    const valorStr = cols[3] || "0";
    const contrato = cols.length > 4 ? cols[4] : undefined;

    // Parse data
    let isoDate: string;
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length !== 3) {
        errors.push(`Linha ${i + 1}: data inválida "${dateStr}"`);
        continue;
      }
      isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    } else {
      isoDate = dateStr; // Já em ISO
    }

    // Parse valor (aceita formato BR e EN)
    let amount = parseBRDecimal(valorStr);
    if (isNaN(amount)) {
      amount = parseFloat(valorStr);
    }
    if (isNaN(amount)) {
      errors.push(`Linha ${i + 1}: valor inválido "${valorStr}"`);
      continue;
    }

    const isCredit = tipo.includes("CREDIT") || tipo.includes("ENTRADA") || amount > 0;

    transactions.push({
      date: isoDate,
      description: contrato ? `${description} [${contrato}]` : description,
      amount: Math.abs(amount),
      docNumber: contrato,
      operationType: tipo || detectOperationType(description),
      isCredit,
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

// ═══════════════════════════════════════════
// AUTO-DETECT & PARSE
// ═══════════════════════════════════════════

export type BankSource = "caixa_csv" | "caixa_ofx" | "pipeimob";

export function detectAndParse(content: string, fileName: string): ParseResult {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const contentLower = content.toLowerCase();

  // OFX
  if (ext === "ofx" || ext === "qfx" || contentLower.includes("<ofx>") || contentLower.includes("ofxheader")) {
    return parseCaixaOFX(content);
  }

  // Pipeimob (detectar por conteúdo)
  if (
    fileName.toLowerCase().includes("pipeimob") ||
    fileName.toLowerCase().includes("pipe") ||
    contentLower.includes("pipeimob") ||
    contentLower.includes("contrato")
  ) {
    return parsePipeimobCSV(content);
  }

  // Default: Caixa CSV
  return parseCaixaCSV(content);
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function parseBRDecimal(value: string): number {
  // Remove espaços e R$
  let clean = value.replace(/\s/g, "").replace(/R\$/g, "").trim();
  // Formato BR: 1.234,56 -> 1234.56
  if (clean.includes(",")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  }
  return parseFloat(clean);
}

function extractOFXField(content: string, field: string): string | undefined {
  // OFX tag: <FIELD>value or <FIELD>value</FIELD>
  const regex = new RegExp(`<${field}>([^<\\n]+)`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : undefined;
}

function detectOperationType(description: string): string {
  const desc = description.toUpperCase();
  if (desc.includes("PIX")) return "PIX";
  if (desc.includes("TED")) return "TED";
  if (desc.includes("DOC")) return "DOC";
  if (desc.includes("BOLETO") || desc.includes("TITULO")) return "BOLETO";
  if (desc.includes("TARIFA") || desc.includes("TAR ")) return "TARIFA";
  if (desc.includes("IOF")) return "IOF";
  if (desc.includes("SAQUE")) return "SAQUE";
  if (desc.includes("DEPOSITO") || desc.includes("DEPÓSITO")) return "DEPOSITO";
  if (desc.includes("TRANSF")) return "TRANSFERENCIA";
  if (desc.includes("ALUGUEL") || desc.includes("LOCACAO")) return "ALUGUEL";
  if (desc.includes("COMISSAO") || desc.includes("COMISSÃO")) return "COMISSAO";
  return "OUTROS";
}

// Classificação automática por categoria (sugestão)
export function suggestCategory(description: string): string | null {
  const desc = description.toUpperCase();

  if (desc.includes("LUZ") || desc.includes("ENERGIA") || desc.includes("CEEE") || desc.includes("RGE")) return "Contas de Consumo";
  if (desc.includes("ÁGUA") || desc.includes("AGUA") || desc.includes("DMAE") || desc.includes("CORSAN")) return "Contas de Consumo";
  if (desc.includes("TELEFON") || desc.includes("INTERNET") || desc.includes("VIVO") || desc.includes("CLARO")) return "Contas de Consumo";
  if (desc.includes("ALUGUEL")) return "Gastos Espaço";
  if (desc.includes("CONDOMINI")) return "Gastos Espaço";
  if (desc.includes("IPTU")) return "Impostos e Taxas";
  if (desc.includes("ISS") || desc.includes("IMPOSTO")) return "Impostos e Taxas";
  if (desc.includes("TARIFA") || desc.includes("TAR ") || desc.includes("ANUIDADE")) return "Tarifas Bancárias";
  if (desc.includes("SALARIO") || desc.includes("SALÁRIO") || desc.includes("FOLHA")) return "Folha Locação";
  if (desc.includes("VALE") && (desc.includes("TRANSPORTE") || desc.includes("REFEIC"))) return "Folha Locação";
  if (desc.includes("MANUTENC") || desc.includes("REPARO") || desc.includes("CONSERTO")) return "Manutenção e Reparos";
  if (desc.includes("MATERIAL") || desc.includes("PAPELARIA")) return "Material de Escritório";
  if (desc.includes("MARKETING") || desc.includes("PUBLICIDADE") || desc.includes("GOOGLE") || desc.includes("META ADS")) return "Op. Locação";
  if (desc.includes("COMISSAO") || desc.includes("COMISSÃO")) return "Folha Locação";

  return null;
}
