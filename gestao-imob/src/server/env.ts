import "server-only";

export type AppEnv = "local" | "homolog" | "production";

const allowedEnvs = new Set<AppEnv>(["local", "homolog", "production"]);

function readAppEnv(): AppEnv {
  const value = (process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? "local")
    .trim()
    .toLowerCase();
  const normalizedValue = value === "homologacao" || value === "hml" ? "homolog" : value;
  if (allowedEnvs.has(normalizedValue as AppEnv)) return normalizedValue as AppEnv;
  throw new Error(`APP_ENV invalido: ${value}. Use local, homolog, homologacao ou production.`);
}

const appEnv = readAppEnv();

export const appConfig = {
  appEnv,
  isLocal: appEnv === "local",
  isHomolog: appEnv === "homolog",
  isProduction: appEnv === "production",
  gatewayStubMode: process.env.GATEWAY_STUB_MODE !== "false",
  allowMockFallbacks: process.env.ALLOW_MOCK_FALLBACKS === "true",
  nfsePrdReady: process.env.NFSE_PRD_READY === "true",
};

export function requiredNfseProductionFields() {
  return [
    "NFSE_GATEWAY_API_KEY",
    "NFSE_COMPANY_ID",
    "NFSE_COMPANY_CNPJ",
    "NFSE_COMPANY_IM",
    "NFSE_CITY_CODE",
    "NFSE_SERVICE_CODE",
    "NFSE_SERVICE_CODE_COMPLEMENT",
    "NFSE_DEFAULT_ALIQUOTA",
  ];
}

export function missingNfseProductionFields() {
  return requiredNfseProductionFields().filter((key) => !process.env[key]);
}

export function nfseEmissionBlockedReason() {
  if (appConfig.isProduction && !appConfig.nfsePrdReady) {
    return "Emissao de NFS-e em PRD bloqueada: os dados fiscais da empresa ainda nao foram confirmados. Configure NFSE_PRD_READY=true somente depois de validar gateway, CNPJ, inscricao municipal, codigo de servico e aliquota.";
  }

  if (appConfig.isProduction) {
    const missing = missingNfseProductionFields();
    if (missing.length > 0) {
      return `Emissao de NFS-e em PRD bloqueada: variaveis fiscais ausentes (${missing.join(", ")}).`;
    }
  }

  return null;
}

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
    for (const key of ["AUTH_ADMIN_EMAIL", "AUTH_ADMIN_HASH"]) {
      if (!process.env[key]) errors.push(`${key} obrigatorio fora do ambiente local.`);
    }
  }

  if (appConfig.isProduction) {
    for (const key of [
      "AUTH_OWNER_1_EMAIL",
      "AUTH_OWNER_1_HASH",
      "AUTH_OWNER_2_EMAIL",
      "AUTH_OWNER_2_HASH",
    ]) {
      if (!process.env[key]) errors.push(`${key} obrigatorio em production.`);
    }
  }

  if (appConfig.isProduction && !process.env.AUTH_URL?.startsWith("https://")) {
    errors.push("AUTH_URL em production deve usar HTTPS.");
  }

  if (appConfig.isProduction && appConfig.gatewayStubMode) {
    errors.push("GATEWAY_STUB_MODE=true nao pode ser usado em production.");
  }

  if (appConfig.isProduction && process.env.NFSE_HOMOLOGACAO === "true") {
    errors.push("NFSE_HOMOLOGACAO=true nao pode ser usado em production.");
  }

  if (appConfig.isHomolog && !appConfig.gatewayStubMode && process.env.NFSE_HOMOLOGACAO !== "true") {
    errors.push("Ambiente homolog exige NFSE_HOMOLOGACAO=true quando gateway real esta ativo.");
  }

  if (!appConfig.isLocal && appConfig.allowMockFallbacks) {
    errors.push("ALLOW_MOCK_FALLBACKS=true nao pode ser usado fora do ambiente local.");
  }

  const shouldRequireGatewayCredentials =
    !appConfig.gatewayStubMode && (!appConfig.isProduction || appConfig.nfsePrdReady);

  if (shouldRequireGatewayCredentials) {
    for (const key of ["NFSE_GATEWAY_API_KEY", "NFSE_COMPANY_ID"]) {
      if (!process.env[key]) errors.push(`${key} obrigatorio quando gateway real esta ativo.`);
    }
  }

  if (appConfig.isProduction && appConfig.nfsePrdReady) {
    for (const key of requiredNfseProductionFields()) {
      if (!process.env[key]) errors.push(`${key} obrigatorio quando NFSE_PRD_READY=true.`);
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
    nfsePrdReady: appConfig.nfsePrdReady,
    nfseEmissionBlocked: Boolean(nfseEmissionBlockedReason()),
  };
}
