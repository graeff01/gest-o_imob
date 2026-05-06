import "server-only";
import { appConfig, missingNfseProductionFields, nfseEmissionBlockedReason } from "@/server/env";

export function getNFSeCompanyConfig() {
  const emissionBlockedReason = nfseEmissionBlockedReason();

  return {
    appEnv: appConfig.appEnv,
    provider: process.env.NFSE_GATEWAY_PROVIDER ?? "nfseio",
    gatewayMode: appConfig.gatewayStubMode ? "stub" : "real",
    apiKeyConfigured: Boolean(process.env.NFSE_GATEWAY_API_KEY),
    companyIdConfigured: Boolean(process.env.NFSE_COMPANY_ID),
    companyCnpjConfigured: Boolean(process.env.NFSE_COMPANY_CNPJ),
    municipalRegistrationConfigured: Boolean(process.env.NFSE_COMPANY_IM),
    cityCode: process.env.NFSE_CITY_CODE ?? "4304606",
    serviceCode: process.env.NFSE_SERVICE_CODE ?? "10.05.01",
    serviceCodeComplement: process.env.NFSE_SERVICE_CODE_COMPLEMENT ?? "10.05.01.002",
    defaultAliquota: process.env.NFSE_DEFAULT_ALIQUOTA ?? "2.0",
    homologacao: process.env.NFSE_HOMOLOGACAO === "true",
    prdReady: appConfig.nfsePrdReady,
    emissionEnabled: !emissionBlockedReason,
    emissionBlockedReason,
    pendingProductionFields: appConfig.isProduction ? missingNfseProductionFields() : [],
  };
}
