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

// ═══════════════════════════════════════════
// CATEGORIZAÇÃO INTELIGENTE
// ═══════════════════════════════════════════

/**
 * Categorias do sistema — cada transação é classificada em uma dessas.
 * As cores são usadas nos gráficos e badges.
 */
export const CATEGORIES = {
  "Aluguel Recebido":        { color: "bg-green-100 text-green-800",  icon: "🏠", type: "receita" },
  "Comissão Recebida":       { color: "bg-emerald-100 text-emerald-800", icon: "💰", type: "receita" },
  "Repasse Recebido":        { color: "bg-teal-100 text-teal-800",   icon: "🔄", type: "receita" },
  "Outras Receitas":         { color: "bg-lime-100 text-lime-800",   icon: "📈", type: "receita" },
  "Folha / Comissões":       { color: "bg-blue-100 text-blue-800",   icon: "👥", type: "despesa" },
  "Royalties Franquia":      { color: "bg-violet-100 text-violet-800", icon: "🏢", type: "despesa" },
  "Contas de Consumo":       { color: "bg-amber-100 text-amber-800", icon: "⚡", type: "despesa" },
  "Aluguel Escritório":      { color: "bg-orange-100 text-orange-800", icon: "🏗️", type: "despesa" },
  "Condomínio":              { color: "bg-yellow-100 text-yellow-800", icon: "🏢", type: "despesa" },
  "IPTU / Impostos":         { color: "bg-red-100 text-red-800",     icon: "📋", type: "despesa" },
  "Tarifas Bancárias":       { color: "bg-slate-100 text-slate-800", icon: "🏦", type: "despesa" },
  "Marketing / Publicidade": { color: "bg-pink-100 text-pink-800",   icon: "📣", type: "despesa" },
  "Manutenção / Reparos":    { color: "bg-cyan-100 text-cyan-800",   icon: "🔧", type: "despesa" },
  "Material Escritório":     { color: "bg-indigo-100 text-indigo-800", icon: "📎", type: "despesa" },
  "Software / Sistemas":     { color: "bg-purple-100 text-purple-800", icon: "💻", type: "despesa" },
  "Seguros":                 { color: "bg-sky-100 text-sky-800",     icon: "🛡️", type: "despesa" },
  "Contabilidade / Jurídico":{ color: "bg-fuchsia-100 text-fuchsia-800", icon: "⚖️", type: "despesa" },
  "Transporte / Combustível":{ color: "bg-stone-100 text-stone-800", icon: "🚗", type: "despesa" },
  "Outros":                  { color: "bg-gray-100 text-gray-800",   icon: "📌", type: "despesa" },
} as const;

export type CategoryName = keyof typeof CATEGORIES;

/**
 * Categorização inteligente por palavras-chave na descrição do extrato.
 * Retorna a categoria sugerida ou "Outros" como fallback.
 */
export function suggestCategory(description: string): CategoryName {
  const desc = description.toUpperCase();

  // ── RECEITAS ──
  if (desc.includes("ALUGUEL") && (desc.includes("RECEB") || desc.includes("CREDIT"))) return "Aluguel Recebido";
  if (desc.includes("LOCACAO") && desc.includes("RECEB")) return "Aluguel Recebido";
  if ((desc.includes("COMISSAO") || desc.includes("COMISSÃO")) && desc.includes("RECEB")) return "Comissão Recebida";
  if (desc.includes("REPASSE") || desc.includes("PIPEIMOB")) return "Repasse Recebido";

  // ── FOLHA / COMISSÕES (saída) ──
  if (desc.includes("SALARIO") || desc.includes("SALÁRIO") || desc.includes("FOLHA PGTO")) return "Folha / Comissões";
  if ((desc.includes("COMISSAO") || desc.includes("COMISSÃO")) && !desc.includes("RECEB")) return "Folha / Comissões";
  if (desc.includes("VALE") && (desc.includes("TRANSPORTE") || desc.includes("REFEIC") || desc.includes("ALIMENT"))) return "Folha / Comissões";
  if (desc.includes("FGTS") || desc.includes("INSS") || desc.includes("RESCISAO")) return "Folha / Comissões";
  if (desc.includes("FERIAS") || desc.includes("13 SALARIO") || desc.includes("DECIMO")) return "Folha / Comissões";

  // ── ROYALTIES FRANQUIA ──
  if (desc.includes("AUXILIADORA") || desc.includes("ROYALT") || desc.includes("FRANQUIA")) return "Royalties Franquia";

  // ── CONTAS DE CONSUMO ──
  if (desc.includes("LUZ") || desc.includes("ENERGIA") || desc.includes("CEEE") || desc.includes("RGE") || desc.includes("CPFL")) return "Contas de Consumo";
  if (desc.includes("ÁGUA") || desc.includes("AGUA") || desc.includes("DMAE") || desc.includes("CORSAN")) return "Contas de Consumo";
  if (desc.includes("GAS") || desc.includes("SULGAS")) return "Contas de Consumo";
  if (desc.includes("TELEFON") || desc.includes("INTERNET") || desc.includes("VIVO") || desc.includes("CLARO") || desc.includes("TIM") || desc.includes("OI ")) return "Contas de Consumo";

  // ── ALUGUEL ESCRITÓRIO ──
  if (desc.includes("ALUGUEL") && !desc.includes("RECEB") && !desc.includes("CREDIT")) return "Aluguel Escritório";
  if (desc.includes("LOCACAO") && !desc.includes("RECEB")) return "Aluguel Escritório";

  // ── CONDOMÍNIO ──
  if (desc.includes("CONDOMINI") || desc.includes("COND ")) return "Condomínio";

  // ── IMPOSTOS ──
  if (desc.includes("IPTU")) return "IPTU / Impostos";
  if (desc.includes("ISS") || desc.includes("IMPOSTO") || desc.includes("DAS ") || desc.includes("SIMPLES NACIONAL")) return "IPTU / Impostos";
  if (desc.includes("DARF") || desc.includes("IRPJ") || desc.includes("CSLL") || desc.includes("PIS") || desc.includes("COFINS")) return "IPTU / Impostos";

  // ── TARIFAS BANCÁRIAS ──
  if (desc.includes("TARIFA") || desc.includes("TAR ") || desc.includes("ANUIDADE") || desc.includes("MANUT CONTA") || desc.includes("IOF")) return "Tarifas Bancárias";
  if (desc.includes("TED TARIFA") || desc.includes("PIX TARIFA") || desc.includes("TAXA BANCARIA")) return "Tarifas Bancárias";

  // ── MARKETING ──
  if (desc.includes("MARKETING") || desc.includes("PUBLICIDADE") || desc.includes("GOOGLE") || desc.includes("META ADS") || desc.includes("FACEBOOK")) return "Marketing / Publicidade";
  if (desc.includes("INSTAGRAM") || desc.includes("ANUNCIO") || desc.includes("PROPAGANDA") || desc.includes("OLX") || desc.includes("ZAP IMOV")) return "Marketing / Publicidade";

  // ── MANUTENÇÃO ──
  if (desc.includes("MANUTENC") || desc.includes("REPARO") || desc.includes("CONSERTO") || desc.includes("REFORMA")) return "Manutenção / Reparos";
  if (desc.includes("LIMPEZA") || desc.includes("PINTURA") || desc.includes("ELETRIC") || desc.includes("ENCANAD")) return "Manutenção / Reparos";

  // ── MATERIAL ESCRITÓRIO ──
  if (desc.includes("MATERIAL") || desc.includes("PAPELARIA") || desc.includes("KALUNGA") || desc.includes("STAPLES")) return "Material Escritório";
  if (desc.includes("CARTORIO") || desc.includes("XEROX") || desc.includes("IMPRESSAO")) return "Material Escritório";

  // ── SOFTWARE / SISTEMAS ──
  if (desc.includes("SOFTWAR") || desc.includes("SISTEMA") || desc.includes("LICEN") || desc.includes("ASSINATURA")) return "Software / Sistemas";
  if (desc.includes("IMOVIEW") || desc.includes("SUPERLOGI") || desc.includes("JETIMOB") || desc.includes("ARBO")) return "Software / Sistemas";
  if (desc.includes("MICROSOFT") || desc.includes("ADOBE") || desc.includes("ZOOM") || desc.includes("SLACK")) return "Software / Sistemas";

  // ── SEGUROS ──
  if (desc.includes("SEGURO") || desc.includes("PORTO SEGURO") || desc.includes("BRADESCO SEGUR") || desc.includes("ZURICH")) return "Seguros";

  // ── CONTABILIDADE / JURÍDICO ──
  if (desc.includes("CONTABIL") || desc.includes("CONTADOR") || desc.includes("ESCRITORIO CONTAB")) return "Contabilidade / Jurídico";
  if (desc.includes("ADVOGAD") || desc.includes("JURIDIC") || desc.includes("HONORAR")) return "Contabilidade / Jurídico";

  // ── TRANSPORTE ──
  if (desc.includes("COMBUSTI") || desc.includes("GASOLINA") || desc.includes("POSTO") || desc.includes("SHELL") || desc.includes("IPIRANGA")) return "Transporte / Combustível";
  if (desc.includes("UBER") || desc.includes("99 ") || desc.includes("ESTACIONAM") || desc.includes("PEDAGIO")) return "Transporte / Combustível";

  // ── RECEITAS GENÉRICAS (créditos não categorizados acima) ──
  // Esta checagem é feita por último — se a transação é crédito e não foi pega acima
  // O caller pode checar isCredit e reclassificar

  return "Outros";
}
