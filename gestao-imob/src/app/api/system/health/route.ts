import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appConfig } from "@/server/env";
import { AuthError, requireTechnicalRole } from "@/server/authz";

type CheckStatus = "OK" | "WARN" | "FAIL";

interface SystemCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

function check(id: string, label: string, status: CheckStatus, detail: string): SystemCheck {
  return { id, label, status, detail };
}

function envDefined(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  try {
    await requireTechnicalRole();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("System health auth error:", error);
    return NextResponse.json({ error: "Erro de autenticacao." }, { status: 500 });
  }

  const checks: SystemCheck[] = [];

  checks.push(check("app-env", "Ambiente", "OK", appConfig.appEnv));
  checks.push(
    check(
      "gateway-mode",
      "Gateway NFS-e",
      appConfig.isProduction && appConfig.gatewayStubMode ? "FAIL" : appConfig.gatewayStubMode ? "WARN" : "OK",
      appConfig.gatewayStubMode ? "Modo simulado ativo" : "Modo real ativo"
    )
  );
  checks.push(
    check(
      "mock-fallbacks",
      "Fallbacks mock",
      appConfig.allowMockFallbacks ? "WARN" : "OK",
      appConfig.allowMockFallbacks ? "Permitidos apenas para desenvolvimento local" : "Desligados"
    )
  );
  checks.push(
    check(
      "auth-secret",
      "Segredo de autenticacao",
      envDefined("AUTH_SECRET") ? "OK" : "FAIL",
      envDefined("AUTH_SECRET") ? "Configurado" : "AUTH_SECRET ausente"
    )
  );
  checks.push(
    check(
      "database-url",
      "Banco de dados",
      envDefined("DATABASE_URL") ? "OK" : appConfig.isLocal ? "WARN" : "FAIL",
      envDefined("DATABASE_URL") ? "DATABASE_URL configurado" : "DATABASE_URL ausente"
    )
  );

  if (!appConfig.gatewayStubMode) {
    checks.push(
      check(
        "nfse-api-key",
        "API Key NFS-e",
        envDefined("NFSE_GATEWAY_API_KEY") ? "OK" : "FAIL",
        envDefined("NFSE_GATEWAY_API_KEY") ? "Configurada" : "NFSE_GATEWAY_API_KEY ausente"
      )
    );
    checks.push(
      check(
        "nfse-company",
        "Empresa NFS-e",
        envDefined("NFSE_COMPANY_ID") ? "OK" : "FAIL",
        envDefined("NFSE_COMPANY_ID") ? "Configurada" : "NFSE_COMPANY_ID ausente"
      )
    );
  }

  let database: {
    connected: boolean;
    usersActive?: number;
    invoicesTotal?: number;
    invoicesPending?: number;
    error?: string;
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    const [usersActive, invoicesTotal, invoicesPending] = await Promise.all([
      prisma.user.count({ where: { is_active: true } }),
      prisma.invoice.count(),
      prisma.invoice.count({ where: { status: "PENDENTE" } }),
    ]);
    database = { connected: true, usersActive, invoicesTotal, invoicesPending };
    checks.push(check("database-connection", "Conexao com banco", "OK", "Banco respondeu SELECT 1"));
    checks.push(
      check(
        "active-users",
        "Usuarios ativos",
        usersActive === 3 ? "OK" : usersActive > 0 ? "WARN" : "FAIL",
        `${usersActive} usuario(s) ativo(s). Esperado para PRD: 3`
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    database = { connected: false, error: message };
    checks.push(check("database-connection", "Conexao com banco", "FAIL", message));
  }

  const scoreBase = checks.length || 1;
  const okCount = checks.filter((item) => item.status === "OK").length;
  const failCount = checks.filter((item) => item.status === "FAIL").length;
  const warnCount = checks.filter((item) => item.status === "WARN").length;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    environment: {
      appEnv: appConfig.appEnv,
      gatewayMode: appConfig.gatewayStubMode ? "stub" : "real",
      mockFallbacks: appConfig.allowMockFallbacks ? "enabled" : "disabled",
      isProduction: appConfig.isProduction,
    },
    score: Math.round((okCount / scoreBase) * 100),
    summary: {
      ok: okCount,
      warn: warnCount,
      fail: failCount,
    },
    checks,
    database,
  });
}
