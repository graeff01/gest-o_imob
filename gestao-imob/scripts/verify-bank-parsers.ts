import { detectAndParse, suggestTransactionClassification } from "../src/lib/utils/bank-parsers";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const fixtures = [
  {
    name: "caixa.ofx",
    content: `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>104</BANKID><ACCTID>123</ACCTID></BANKACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260401000000<TRNAMT>-123.45<FITID>1<NAME>COMPRA ZAFFARI<MEMO>MERCADO</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260402000000<TRNAMT>2500.00<FITID>2<NAME>PIX RECEBIDO ALUGUEL</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`,
    expectedBank: "Caixa Economica Federal",
    expectedCount: 2,
  },
  {
    name: "sicredi.csv",
    content: "Data;Descricao;Valor;Saldo\n01/04/2026;SICREDI PIX FARMACIA PANVEL;-45,90;1000,00\n02/04/2026;TED RECEBIDA INTERMEDIACAO;1200,00;2200,00",
    expectedBank: "Sicredi",
    expectedCount: 2,
  },
  {
    name: "bradesco.csv",
    content: "Data Lancamento,Historico,Valor,Balance\n2026-04-03,BRADESCO TARIFA CESTA,-29.90,900.00",
    expectedBank: "Bradesco",
    expectedCount: 1,
  },
  {
    name: "itau.xml",
    content: `<?xml version="1.0"?><extrato><banco>Itau</banco><lancamento><data>04/04/2026</data><descricao>COMPRA LEROY FERRAGEM</descricao><valor>-300,00</valor><documento>10</documento></lancamento></extrato>`,
    expectedBank: "Itau",
    expectedCount: 1,
  },
];

for (const fixture of fixtures) {
  const result = detectAndParse(fixture.content, fixture.name);
  assert(result.success, `${fixture.name}: deveria parsear`);
  assert(result.bankName === fixture.expectedBank, `${fixture.name}: banco ${result.bankName}`);
  assert(result.transactions.length === fixture.expectedCount, `${fixture.name}: total ${result.transactions.length}`);
}

assert(suggestTransactionClassification("COMPRA PANVEL FARMACIA", false).category === "Farmacia", "categoria farmacia");
assert(suggestTransactionClassification("PIX RECEBIDO ALUGUEL", true).kind === "receita", "entrada aluguel");

console.log("bank parser verification ok");
