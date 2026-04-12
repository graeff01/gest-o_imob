/**
 * GET /api/invoices/sample-dw
 * ---------------------------
 * Gera e retorna um arquivo Excel (.xlsx) de exemplo no formato DW
 * para testar o fluxo de importação de notas fiscais.
 */

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  // Cabeçalho conforme o parser espera (colunas A-M)
  const header = [
    "DATA VENCIMENTO",    // A
    "NOME AGENCIA",       // B
    "HISTORICO",          // C
    "IMOVEL",             // D
    "ENDEREÇO IMOVEL",    // E
    "PROPRIETARIO",       // F
    "PROPRIETARIO CPF",   // G
    "NUMERO TITULO",      // H
    "SITUACAO TITULO",    // I
    "STATUS TITULO",      // J
    "TIPO",               // K
    "VALOR P",            // L
    "QTD TÍTULO",         // M
  ];

  // Dados de exemplo — simulando um export real do DW
  const rows = [
    [
      "2026-05-10",
      "FRANQUIA MOINHOS DE VENTO",
      "INTERMEDIAÇÃO FRANQUIA - FRANQUIA MOINHOS DE VENTO - 1/1",
      "AP-2301",
      "Rua Padre Chagas, 500 — Apto 2301, Moinhos de Vento",
      "Carlos Eduardo Machado",
      "01234567890",
      "TIT-2026-DW-001",
      "PENDENTE",
      "A VENCER",
      "Intermediação",
      3800.00,
      1,
    ],
    [
      "2026-05-15",
      "FRANQUIA MOINHOS DE VENTO",
      "ADMINISTRAÇÃO FRANQUIA - FRANQUIA MOINHOS DE VENTO - 1/1",
      "CS-42",
      "Rua Fernando Gomes, 42 — Casa, Bela Vista",
      "Márcia Fernandes de Souza",
      "98765432100",
      "TIT-2026-DW-002",
      "PENDENTE",
      "A VENCER",
      "Administração",
      2100.00,
      1,
    ],
    [
      "2026-05-20",
      "FRANQUIA MOINHOS DE VENTO",
      "AGENCIAMENTO FRANQUIA - FRANQUIA MOINHOS DE VENTO - 1/1",
      "SL-710",
      "Av. Independência, 1200 — Sala 710, Independência",
      "Construtora Litoral Ltda",
      "12345678000190",
      "TIT-2026-DW-003",
      "PENDENTE",
      "A VENCER",
      "Agenciamento",
      5450.00,
      1,
    ],
    [
      "2026-04-30",
      "FRANQUIA MOINHOS DE VENTO",
      "INTERMEDIAÇÃO FRANQUIA - FRANQUIA MOINHOS DE VENTO - 2/3",
      "AP-604",
      "Rua Dona Laura, 180 — Apto 604, Rio Branco",
      "Juliana Pires Martins",
      "45678901234",
      "TIT-2026-DW-004",
      "ABERTO",
      "VENCIDO",
      "Intermediação",
      4200.00,
      1,
    ],
    [
      "2026-05-25",
      "FRANQUIA MOINHOS DE VENTO",
      "ADMINISTRAÇÃO FRANQUIA - FRANQUIA MOINHOS DE VENTO - 1/1",
      "AP-1503",
      "Av. Carlos Gomes, 2200 — Apto 1503, Auxiliadora",
      "Roberto Antunes da Silva",
      "56789012345",
      "TIT-2026-DW-005",
      "PENDENTE",
      "A VENCER",
      "Administração",
      1850.00,
      1,
    ],
    [
      "2026-06-10",
      "FRANQUIA MOINHOS DE VENTO",
      "INTERMEDIAÇÃO FRANQUIA - FRANQUIA MOINHOS DE VENTO - 1/1",
      "CS-15",
      "Rua Quintino Bocaiúva, 215 — Casa, Moinhos de Vento",
      "Gabriela Lemos Rodrigues",
      "67890123456",
      "TIT-2026-DW-006",
      "PENDENTE",
      "A VENCER",
      "Intermediação",
      12500.00,
      1,
    ],
  ];

  // Monta o workbook
  const data = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Títulos DW");

  // Gera o buffer
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=exemplo_dw_moinhos.xlsx",
    },
  });
}
