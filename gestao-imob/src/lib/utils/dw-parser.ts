/**
 * dw-parser.ts
 * ------------
 * Parser para o arquivo Excel exportado do DW (CRM da franquia Auxiliadora Predial).
 *
 * Estrutura da planilha (colunas identificadas na amostra real):
 *   A  - DATA VENCIMENTO
 *   B  - NOME AGENCIA
 *   C  - HISTORICO          (ex: "INTERMEDIAÇÃO FRANQUIA - FRANQUIA MOINHOS DE VENTO - 3/3")
 *   D  - IMOVEL             (código numérico do imóvel)
 *   E  - ENDEREÇO IMOVEL
 *   F  - PROPRIETARIO       (nome do proprietário/tomador)
 *   G  - PROPRIETARIO CPF   (CPF ou CNPJ do tomador)
 *   H  - NUMERO TITULO      (número único do título — usado para deduplicação)
 *   I  - SITUACAO TITULO    (ex: "PENDENTE")
 *   J  - STATUS TITULO      (ex: "A VENCER" | "VENCIDO")
 *   K  - TIPO               (ex: "INTERMEDIAÇÃO" | "AGENCIAMENTO" | "ADMINISTRAÇÃO")
 *   L  - VALOR P            (valor do serviço)
 *   M  - QTD TÍTULO
 *
 * Uso:
 *   const result = parseDWExcel(buffer);
 *   if (result.errors.length > 0) // mostrar erros ao usuário
 *   result.rows // linhas válidas prontas para inserir no banco
 */

import * as XLSX from "xlsx";

// ─── Tipos de saída ───────────────────────────────────────────────────────────

export type DWServiceType = "INTERMEDIACAO" | "AGENCIAMENTO" | "ADMINISTRACAO";

export type DWInvoiceStatus = "A_VENCER" | "VENCIDO" | "PENDENTE";

export interface DWParsedRow {
  /** Linha da planilha (para debug em caso de erro) */
  rowIndex: number;

  /** Data de vencimento do título */
  due_date: Date;

  /** Mês de competência extraído da data de vencimento */
  reference_month: number;

  /** Ano de competência extraído da data de vencimento */
  reference_year: number;

  /** Nome da agência (ex: "FRANQUIA MOINHOS DE VENTO") */
  agency_name: string;

  /** Histórico completo do lançamento */
  historico: string;

  /** Código numérico do imóvel no DW */
  property_code: string | null;

  /** Endereço completo do imóvel */
  property_address: string | null;

  /** Nome do proprietário / tomador da nota */
  client_name: string;

  /** CPF ou CNPJ do proprietário — limpo (só dígitos) */
  client_cpf_cnpj: string;

  /** Número único do título no DW — chave de deduplicação */
  title_number: string;

  /** Situação do título no DW */
  dw_situation: string;

  /** Status do título no DW */
  dw_status: DWInvoiceStatus;

  /** Tipo de serviço normalizado para o enum do banco */
  service_type: DWServiceType;

  /** Valor do serviço */
  amount: number;

  /** Quantidade de títulos (normalmente 1) */
  qty: number;

  /** Descrição gerada automaticamente para o corpo da NFS-e */
  description_title: string;

  /** Corpo detalhado da NFS-e gerado automaticamente */
  description_body: string;
}

export interface DWParseResult {
  rows: DWParsedRow[];
  errors: DWParseError[];
  totalRows: number;
  validRows: number;
  skippedRows: number;
}

export interface DWParseError {
  rowIndex: number;
  message: string;
  rawData?: Record<string, unknown>;
}

// ─── Constantes de mapeamento ─────────────────────────────────────────────────

/**
 * Mapeamento de strings brutas do DW para o enum interno.
 * Case-insensitive — normalizado antes da comparação.
 */
const SERVICE_TYPE_MAP: Record<string, DWServiceType> = {
  "intermediação": "INTERMEDIACAO",
  "intermediacao": "INTERMEDIACAO",
  "agenciamento": "AGENCIAMENTO",
  "administração": "ADMINISTRACAO",
  "administracao": "ADMINISTRACAO",
};

const STATUS_MAP: Record<string, DWInvoiceStatus> = {
  "a vencer": "A_VENCER",
  "vencido": "VENCIDO",
  "pendente": "PENDENTE",
};

// ─── Funções auxiliares ───────────────────────────────────────────────────────

/**
 * Normaliza um CPF ou CNPJ removendo tudo que não for dígito.
 * Retorna null se o resultado não tiver 11 (CPF) ou 14 (CNPJ) dígitos.
 */
function normalizeCpfCnpj(raw: unknown): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length !== 11 && digits.length !== 14) return null;
  return digits;
}

/**
 * Converte um valor de data do Excel (número serial ou string) para Date JS.
 * O Excel armazena datas como número de dias desde 1900-01-01.
 */
function parseExcelDate(raw: unknown): Date | null {
  if (!raw) return null;

  // Se já for uma string de data (alguns exports do DW vêm como "30 de jun. de 2026")
  if (typeof raw === "string") {
    // Tenta parse direto
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;

    // Tenta formato "DD de MMM. de YYYY" (pt-BR)
    const ptbrMatch = raw.match(/(\d{1,2})\s+de\s+(\w+)\.?\s+de\s+(\d{4})/i);
    if (ptbrMatch) {
      const monthNames: Record<string, number> = {
        jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
        jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
      };
      const month = monthNames[ptbrMatch[2].toLowerCase().slice(0, 3)];
      if (month !== undefined) {
        return new Date(Number(ptbrMatch[3]), month, Number(ptbrMatch[1]));
      }
    }
    return null;
  }

  // Se for número serial do Excel
  if (typeof raw === "number") {
    const date = XLSX.SSF.parse_date_code(raw);
    if (!date) return null;
    return new Date(date.y, date.m - 1, date.d);
  }

  if (raw instanceof Date) return raw;

  return null;
}

/**
 * Extrai o valor numérico de uma célula, suportando string com vírgula decimal.
 */
function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return raw;
  const cleaned = String(raw).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Gera o título e o corpo da NFS-e com base nos dados do DW.
 * Esta é a descrição que vai para a prefeitura — deve ser clara e precisa.
 */
function generateNFSeDescription(row: {
  service_type: DWServiceType;
  property_address: string | null;
  property_code: string | null;
  historico: string;
  reference_month: number;
  reference_year: number;
}): { title: string; body: string } {
  const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const monthName = MONTH_NAMES[row.reference_month - 1] ?? "";
  const period = `${monthName}/${row.reference_year}`;

  const titleMap: Record<DWServiceType, string> = {
    INTERMEDIACAO: "Intermediação de Locação Imobiliária",
    AGENCIAMENTO: "Agenciamento de Imóvel",
    ADMINISTRACAO: "Administração de Locação Imobiliária",
  };

  const title = titleMap[row.service_type];

  const addressPart = row.property_address
    ? ` referente ao imóvel situado em ${row.property_address}`
    : row.property_code
      ? ` referente ao imóvel de código ${row.property_code}`
      : "";

  const bodyMap: Record<DWServiceType, string> = {
    INTERMEDIACAO: `Serviço de intermediação de locação imobiliária${addressPart}, competência ${period}.`,
    AGENCIAMENTO: `Serviço de agenciamento e captação de imóvel${addressPart}, competência ${period}.`,
    ADMINISTRACAO: `Taxa de administração de contrato de locação imobiliária${addressPart}, competência ${period}.`,
  };

  return { title, body: bodyMap[row.service_type] };
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Faz o parse do Excel exportado do DW e retorna as linhas normalizadas.
 *
 * @param buffer - Buffer do arquivo Excel (.xlsx ou .xls)
 * @returns DWParseResult com linhas válidas e erros encontrados
 */
export function parseDWExcel(buffer: Buffer): DWParseResult {
  const rows: DWParsedRow[] = [];
  const errors: DWParseError[] = [];

  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  } catch {
    return {
      rows: [],
      errors: [{ rowIndex: 0, message: "Arquivo inválido ou corrompido. Envie um arquivo .xlsx ou .xls válido." }],
      totalRows: 0,
      validRows: 0,
      skippedRows: 0,
    };
  }

  // Pega a primeira aba (o DW exporta tudo na Sheet1)
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      errors: [{ rowIndex: 0, message: "Arquivo sem abas. Verifique se exportou corretamente do DW." }],
      totalRows: 0,
      validRows: 0,
      skippedRows: 0,
    };
  }

  const sheet = workbook.Sheets[sheetName];

  // Converte para array de arrays (raw values) — linha 0 = cabeçalho
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,       // Array de arrays, não objeto
    defval: null,    // Células vazias = null
    raw: true,       // Preservar valores numéricos originais (importante para datas e valores)
  });

  if (rawData.length < 2) {
    return {
      rows: [],
      errors: [{ rowIndex: 0, message: "Arquivo vazio ou sem dados. A primeira linha deve ser o cabeçalho." }],
      totalRows: 0,
      validRows: 0,
      skippedRows: 0,
    };
  }

  // Linha 0 = cabeçalho, dados começam na linha 1
  const dataRows = rawData.slice(1);
  let skippedRows = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i] as unknown[];
    const rowIndex = i + 2; // +2 porque linha 1 = cabeçalho, índice começa em 1 no Excel

    // Pula linhas completamente vazias (comum no final de exportações)
    if (!r || r.every((cell) => cell === null || cell === "")) {
      skippedRows++;
      continue;
    }

    // ── Extração das células ──
    const rawDueDate     = r[0];  // A - DATA VENCIMENTO
    const rawAgency      = r[1];  // B - NOME AGENCIA
    const rawHistorico   = r[2];  // C - HISTORICO
    const rawPropertyCode = r[3]; // D - IMOVEL
    const rawAddress     = r[4];  // E - ENDEREÇO IMOVEL
    const rawClientName  = r[5];  // F - PROPRIETARIO (nome)
    const rawClientDoc   = r[6];  // G - PROPRIETARIO (CPF/CNPJ)
    const rawTitleNumber = r[7];  // H - NUMERO TITULO
    const rawSituation   = r[8];  // I - SITUACAO TITULO
    const rawStatus      = r[9];  // J - STATUS TITULO
    const rawType        = r[10]; // K - TIPO
    const rawAmount      = r[11]; // L - VALOR P
    const rawQty         = r[12]; // M - QTD TÍTULO

    // ── Validações obrigatórias ──
    const rawData: Record<string, unknown> = { A: rawDueDate, B: rawAgency, C: rawHistorico, K: rawType, L: rawAmount };

    // Data de vencimento
    const due_date = parseExcelDate(rawDueDate);
    if (!due_date) {
      errors.push({ rowIndex, message: `Data de vencimento inválida: "${rawDueDate}"`, rawData });
      continue;
    }

    // Nome do cliente
    const client_name = rawClientName ? String(rawClientName).trim() : "";
    if (!client_name) {
      errors.push({ rowIndex, message: "Nome do proprietário/tomador ausente.", rawData });
      continue;
    }

    // CPF/CNPJ
    const client_cpf_cnpj = normalizeCpfCnpj(rawClientDoc);
    if (!client_cpf_cnpj) {
      errors.push({ rowIndex, message: `CPF/CNPJ inválido ou ausente: "${rawClientDoc}"`, rawData });
      continue;
    }

    // Número do título (chave de deduplicação)
    const title_number = rawTitleNumber ? String(rawTitleNumber).trim() : "";
    if (!title_number) {
      errors.push({ rowIndex, message: "Número do título ausente — não é possível garantir deduplicação.", rawData });
      continue;
    }

    // Tipo de serviço
    const rawTypeStr = rawType ? String(rawType).trim().toLowerCase() : "";
    const service_type = SERVICE_TYPE_MAP[rawTypeStr];
    if (!service_type) {
      errors.push({ rowIndex, message: `Tipo de serviço desconhecido: "${rawType}". Esperado: Intermediação, Agenciamento ou Administração.`, rawData });
      continue;
    }

    // Valor
    const amount = parseAmount(rawAmount);
    if (amount === null || amount <= 0) {
      errors.push({ rowIndex, message: `Valor inválido: "${rawAmount}"`, rawData });
      continue;
    }

    // ── Campos opcionais ──
    const agency_name    = rawAgency ? String(rawAgency).trim() : "";
    const historico      = rawHistorico ? String(rawHistorico).trim() : "";
    const property_code  = rawPropertyCode ? String(rawPropertyCode).trim() : null;
    const property_address = rawAddress ? String(rawAddress).trim() : null;
    const dw_situation   = rawSituation ? String(rawSituation).trim() : "";
    const rawStatusStr   = rawStatus ? String(rawStatus).trim().toLowerCase() : "";
    const dw_status      = STATUS_MAP[rawStatusStr] ?? "PENDENTE";
    const qty            = rawQty ? Number(rawQty) : 1;

    const reference_month = due_date.getMonth() + 1; // getMonth() é 0-based
    const reference_year  = due_date.getFullYear();

    // ── Gera descrição automática para a NFS-e ──
    const { title: description_title, body: description_body } = generateNFSeDescription({
      service_type,
      property_address,
      property_code,
      historico,
      reference_month,
      reference_year,
    });

    rows.push({
      rowIndex,
      due_date,
      reference_month,
      reference_year,
      agency_name,
      historico,
      property_code,
      property_address,
      client_name,
      client_cpf_cnpj,
      title_number,
      dw_situation,
      dw_status,
      service_type,
      amount,
      qty,
      description_title,
      description_body,
    });
  }

  return {
    rows,
    errors,
    totalRows: dataRows.length - skippedRows,
    validRows: rows.length,
    skippedRows,
  };
}
