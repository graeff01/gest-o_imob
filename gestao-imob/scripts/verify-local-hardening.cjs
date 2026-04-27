const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const XLSX = require("xlsx");

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

function normalizeHash(hash) {
  return String(hash || "").replace(/\\\$/g, "$");
}

async function main() {
  const checks = [];
  const appEnv = process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || "local";
  checks.push(["APP_ENV", ["local", "homolog", "production"].includes(appEnv), appEnv]);
  checks.push(["AUTH_SECRET", Boolean(process.env.AUTH_SECRET), process.env.AUTH_SECRET ? "definido" : "ausente"]);
  checks.push(["AUTH_ADMIN_EMAIL", Boolean(process.env.AUTH_ADMIN_EMAIL), process.env.AUTH_ADMIN_EMAIL || "ausente"]);

  const hash = normalizeHash(process.env.AUTH_ADMIN_HASH);
  const loginOk = await bcrypt.compare("admin2026", hash);
  checks.push(["senha local admin2026", loginOk, loginOk ? "ok" : "falhou"]);

  const samplePath = path.join(process.env.USERPROFILE || "", "Downloads", "exemplo_dw_moinhos (1).xlsx");
  if (fs.existsSync(samplePath)) {
    const wb = XLSX.readFile(samplePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    const expected = [
      "DATA VENCIMENTO",
      "NOME AGENCIA",
      "HISTORICO",
      "IMOVEL",
      "ENDEREÇO IMOVEL",
      "PROPRIETARIO",
      "PROPRIETARIO CPF",
      "NUMERO TITULO",
      "SITUACAO TITULO",
      "STATUS TITULO",
      "TIPO",
      "VALOR P",
      "QTD TÍTULO",
    ];
    const headerOk = expected.every((value, index) => rows[0]?.[index] === value);
    checks.push(["arquivo DW exemplo", headerOk, `${rows.length} linhas em ${wb.SheetNames[0]}`]);
  } else {
    checks.push(["arquivo DW exemplo", true, "nao encontrado; checagem ignorada"]);
  }

  console.table(checks.map(([name, ok, detail]) => ({ check: name, ok, detail })));
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
