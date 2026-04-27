import "server-only";

export function getNFSeCompanyConfig() {
  return {
    provider: process.env.NFSE_GATEWAY_PROVIDER ?? "nfseio",
    companyIdConfigured: Boolean(process.env.NFSE_COMPANY_ID),
    companyCnpjConfigured: Boolean(process.env.NFSE_COMPANY_CNPJ),
    municipalRegistrationConfigured: Boolean(process.env.NFSE_COMPANY_IM),
    cityCode: process.env.NFSE_CITY_CODE ?? "4314902",
    serviceCode: process.env.NFSE_SERVICE_CODE ?? "10.05.01",
    serviceCodeComplement: process.env.NFSE_SERVICE_CODE_COMPLEMENT ?? "10.05.01.002",
    defaultAliquota: process.env.NFSE_DEFAULT_ALIQUOTA ?? "9.0",
    homologacao: process.env.NFSE_HOMOLOGACAO === "true",
  };
}
