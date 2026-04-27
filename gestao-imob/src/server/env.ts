import "server-only";

export type AppEnv = "local" | "homolog" | "production";

const allowedEnvs = new Set<AppEnv>(["local", "homolog", "production"]);

function readAppEnv(): AppEnv {
  const value = process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? "local";
  if (allowedEnvs.has(value as AppEnv)) return value as AppEnv;
  throw new Error(`APP_ENV invalido: ${value}. Use local, homolog ou production.`);
}

export const appConfig = {
  appEnv: readAppEnv(),
  isLocal: readAppEnv() === "local",
  isHomolog: readAppEnv() === "homolog",
  isProduction: readAppEnv() === "production",
  gatewayStubMode: process.env.GATEWAY_STUB_MODE !== "false",
  allowMockFallbacks: process.env.ALLOW_MOCK_FALLBACKS === "true",
};

export function assertRuntimeSafety() {
  const errors: string[] = [];

  if (!process.env.AUTH_SECRET) {
    errors.push("AUTH_SECRET ausente.");
  }

  if (appConfig.isProduction && process.env.AUTH_SECRET?.includes("preview")) {
    errors.push("AUTH_SECRET de preview nao pode ser usado em production.");
  }

  if (!appConfig.isLocal && !process.env.DATABASE_URL) {
    errors.push("DATABASE_URL obrigatorio fora do ambiente local.");
  }

  if (!appConfig.isLocal) {
    for (const key of [
      "AUTH_ADMIN_EMAIL",
      "AUTH_ADMIN_HASH",
      "AUTH_OWNER_1_EMAIL",
      "AUTH_OWNER_1_HASH",
      "AUTH_OWNER_2_EMAIL",
      "AUTH_OWNER_2_HASH",
    ]) {
      if (!process.env[key]) errors.push(`${key} obrigatorio fora do ambiente local.`);
    }
  }

  if (appConfig.isProduction && !process.env.AUTH_URL?.startsWith("https://")) {
    errors.push("AUTH_URL em production deve usar HTTPS.");
  }

  if (appConfig.isProduction && appConfig.gatewayStubMode) {
    errors.push("GATEWAY_STUB_MODE=true nao pode ser usado em production.");
  }

  if (!appConfig.isLocal && appConfig.allowMockFallbacks) {
    errors.push("ALLOW_MOCK_FALLBACKS=true nao pode ser usado fora do ambiente local.");
  }

  if (!appConfig.gatewayStubMode) {
    for (const key of ["NFSE_GATEWAY_API_KEY", "NFSE_COMPANY_ID"]) {
      if (!process.env[key]) errors.push(`${key} obrigatorio quando gateway real esta ativo.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuracao insegura:\n- ${errors.join("\n- ")}`);
  }
}

export function publicRuntimeFlags() {
  return {
    appEnv: appConfig.appEnv,
    showDemoCredentials: appConfig.isLocal,
    gatewayMode: appConfig.gatewayStubMode ? "stub" : "real",
    mockFallbacks: appConfig.allowMockFallbacks ? "enabled" : "disabled",
  };
}
