/**
 * nfse-gateway.ts
 * ---------------
 * Abstração sobre o gateway de emissão de NFS-e.
 *
 * Gateway principal: nfse.io
 * Docs: https://nfse.io/docs
 *
 * ─── COMO ATIVAR ──────────────────────────────────────────────────────────────
 *
 * 1. Crie conta em https://nfse.io e faça upload do certificado A1 (.pfx)
 * 2. Cadastre a empresa com o CNPJ e a Inscrição Municipal de Porto Alegre
 * 3. Copie a API Key e o Company ID do painel do nfse.io
 * 4. Preencha as variáveis abaixo no .env.local (dev) e no Railway (produção):
 *
 *    GATEWAY_STUB_MODE=false
 *    NFSE_GATEWAY_PROVIDER=nfseio
 *    NFSE_GATEWAY_API_KEY=sua_api_key_do_nfseio
 *    NFSE_COMPANY_ID=id_da_empresa_no_nfseio
 *    NFSE_COMPANY_CNPJ=XX.XXX.XXX/XXXX-XX  (CNPJ da imobiliária)
 *    NFSE_COMPANY_IM=XXXXXXX               (Inscrição Municipal em Porto Alegre)
 *    NFSE_CITY_CODE=4314902                (IBGE de Porto Alegre — não muda)
 *    NFSE_SERVICE_CODE=10.05.01            (código tributação POA para intermediação)
 *    NFSE_SERVICE_CODE_COMPLEMENT=10.05.01.002
 *    NFSE_DEFAULT_ALIQUOTA=9.0             (alíquota Simples Nacional — confirmar com contador)
 *
 * 5. Teste em homologação antes de produção:
 *    NFSE_HOMOLOGACAO=true  → aponta para ambiente de testes do gateway
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Tipos de payload ─────────────────────────────────────────────────────────

export interface NfseEmitPayload {
  invoiceId: string;

  borrower: {
    name: string;
    federalTaxNumber: string; // CPF (11 dígitos) ou CNPJ (14 dígitos) — só dígitos
    email?: string;
    address?: {
      cep: string;
      logradouro?: string;
      municipio?: string;
      uf?: string;
    };
  };

  service: {
    description: string;
    amount: number;
    competence: { month: number; year: number };
    aliquota?: number; // % ex: 9.0 — usa NFSE_DEFAULT_ALIQUOTA se omitido
  };
}

export interface NfseEmitSuccess {
  success: true;
  gatewayId: string;
  nfseNumber: number | null;
  pdfUrl: string | null;
  xmlUrl: string | null;
  gatewayStatus: string;
  provider: string;
}

export interface NfseEmitFailure {
  success: false;
  error: string;
  gatewayErrorCode?: string;
}

export type NfseEmitResult = NfseEmitSuccess | NfseEmitFailure;

// ─── Configuração ─────────────────────────────────────────────────────────────

function getGatewayConfig() {
  return {
    isStub:        process.env.GATEWAY_STUB_MODE !== "false",
    isHomolog:     process.env.NFSE_HOMOLOGACAO === "true",
    provider:      process.env.NFSE_GATEWAY_PROVIDER ?? "nfseio",
    apiKey:        process.env.NFSE_GATEWAY_API_KEY ?? "",
    companyId:     process.env.NFSE_COMPANY_ID ?? "",
    companyCnpj:   (process.env.NFSE_COMPANY_CNPJ ?? "").replace(/\D/g, ""),
    companyIM:     process.env.NFSE_COMPANY_IM ?? "",            // Inscrição Municipal POA
    cityCode:      process.env.NFSE_CITY_CODE ?? "4314902",      // IBGE Porto Alegre
    serviceCode:   process.env.NFSE_SERVICE_CODE ?? "10.05.01",  // Código tributação POA
    serviceCodeComplement: process.env.NFSE_SERVICE_CODE_COMPLEMENT ?? "10.05.01.002",
    defaultAliquota: parseFloat(process.env.NFSE_DEFAULT_ALIQUOTA ?? "9.0"),
  };
}

// ─── nfse.io ──────────────────────────────────────────────────────────────────

async function emitViaNfseIo(
  payload: NfseEmitPayload,
  config: ReturnType<typeof getGatewayConfig>
): Promise<NfseEmitResult> {
  const baseUrl = config.isHomolog
    ? "https://api.sandbox.nfse.io/v1"
    : "https://api.nfse.io/v1";

  const aliquota = payload.service.aliquota ?? config.defaultAliquota;

  // Monta o corpo da requisição conforme a API do nfse.io
  // Ref: https://nfse.io/docs/api/emissao
  const body = {
    // Identificador único para idempotência — garante que reenvios não geram nota duplicada
    external_id: payload.invoiceId,

    // Dados do prestador (empresa emissora)
    provider: {
      cnpj: config.companyCnpj,
      inscricao_municipal: config.companyIM,
      city_ibge_code: config.cityCode,
    },

    // Dados do tomador (quem recebe a nota)
    borrower: {
      federal_tax_number: payload.borrower.federalTaxNumber,
      name: payload.borrower.name,
      ...(payload.borrower.email ? { email: payload.borrower.email } : {}),
      ...(payload.borrower.address?.cep ? {
        address: {
          zip_code:      payload.borrower.address.cep.replace(/\D/g, ""),
          street:        payload.borrower.address.logradouro ?? "",
          city:          payload.borrower.address.municipio ?? "Porto Alegre",
          state:         payload.borrower.address.uf ?? "RS",
          country:       "BRA",
        },
      } : {}),
    },

    // Dados do serviço
    service: {
      // Campos obrigatórios Porto Alegre
      city_service_code:      config.serviceCode,
      city_service_code_complement: config.serviceCodeComplement,
      description:            payload.service.description,
      amount:                 payload.service.amount,
      iss_rate:               aliquota / 100,       // nfse.io aceita fração (0.09 = 9%)
      iss_withheld:           false,                // Retenção ISSQN: Não
      deduction_amount:       0,

      // Tributação federal
      federal_service_code:   "10.05.01",           // LC 116/2003
      pis_withheld:           false,
      cofins_withheld:        false,
      inss_withheld:          false,
      ir_withheld:            false,
      csll_withheld:          false,

      // Competência
      competence: `${payload.service.competence.year}-${String(payload.service.competence.month).padStart(2, "0")}-01`,
    },

    // Regime tributário (Simples Nacional = 1 na maioria dos gateways)
    taxation_type: "simples_nacional",
  };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/companies/${config.companyId}/serviceinvoices`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "X-Request-Id":  payload.invoiceId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Falha ao conectar com nfse.io: ${msg}` };
  }

  let data: Record<string, unknown> = {};
  try { data = await response.json() as Record<string, unknown>; } catch { /* ignora */ }

  if (!response.ok) {
    const detail = (data?.message as string) || (data?.error as string) || response.statusText;
    return {
      success: false,
      error: `nfse.io retornou erro ${response.status}: ${detail}`,
      gatewayErrorCode: String(response.status),
    };
  }

  return {
    success:       true,
    gatewayId:     String(data.id ?? data.external_id ?? ""),
    nfseNumber:    data.number ? Number(data.number) : null,
    pdfUrl:        (data.pdf_url as string) ?? (data.pdfUrl as string) ?? null,
    xmlUrl:        (data.xml_url as string) ?? (data.xmlUrl as string) ?? null,
    gatewayStatus: String(data.status ?? "processing"),
    provider:      "nfseio",
  };
}

// ─── NFe.io (fallback / alternativa) ─────────────────────────────────────────

async function emitViaNfeio(
  payload: NfseEmitPayload,
  config: ReturnType<typeof getGatewayConfig>
): Promise<NfseEmitResult> {
  const url = `https://api.nfe.io/v1/companies/${config.companyId}/serviceinvoices`;
  const aliquota = payload.service.aliquota ?? config.defaultAliquota;

  const body = {
    cityServiceCode:  config.serviceCode,
    issRate:          aliquota / 100,
    servicesAmount:   payload.service.amount,
    description:      payload.service.description,
    competence:       new Date(payload.service.competence.year, payload.service.competence.month - 1, 1).toISOString(),
    borrower: {
      name:             payload.borrower.name,
      federalTaxNumber: payload.borrower.federalTaxNumber,
      email:            payload.borrower.email,
      ...(payload.borrower.address?.cep ? {
        address: {
          postalCode:   payload.borrower.address.cep.replace(/\D/g, ""),
          country:      "BRA",
          state:        payload.borrower.address.uf ?? "RS",
          city:         payload.borrower.address.municipio ?? "Porto Alegre",
        },
      } : {}),
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "X-Request-Id":  payload.invoiceId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Falha ao conectar com NFe.io: ${msg}` };
  }

  let data: Record<string, unknown> = {};
  try { data = await response.json() as Record<string, unknown>; } catch { /* ignora */ }

  if (!response.ok) {
    const detail = (data?.message as string) || response.statusText;
    return {
      success: false,
      error: `NFe.io retornou erro ${response.status}: ${detail}`,
      gatewayErrorCode: String(response.status),
    };
  }

  return {
    success:       true,
    gatewayId:     String(data.id ?? ""),
    nfseNumber:    data.number ? Number(data.number) : null,
    pdfUrl:        (data.pdfUrl as string) ?? null,
    xmlUrl:        (data.xmlUrl as string) ?? null,
    gatewayStatus: String(data.status ?? "processing"),
    provider:      "nfeio",
  };
}

// ─── Stub (desenvolvimento) ───────────────────────────────────────────────────

function emitStub(payload: NfseEmitPayload): NfseEmitResult {
  console.warn(
    `[nfse-gateway] ⚠️  STUB ATIVO — nota ${payload.invoiceId} NÃO foi enviada à prefeitura.`,
    "\nConfigure GATEWAY_STUB_MODE=false e as variáveis NFSE_* no .env para emissão real."
  );
  return {
    success:       true,
    gatewayId:     `stub-${payload.invoiceId}-${Date.now()}`,
    nfseNumber:    null,
    pdfUrl:        null,
    xmlUrl:        null,
    gatewayStatus: "stub_success",
    provider:      "stub",
  };
}

// ─── Função pública ───────────────────────────────────────────────────────────

export async function emitNfse(payload: NfseEmitPayload): Promise<NfseEmitResult> {
  const config = getGatewayConfig();

  if (config.isStub) return emitStub(payload);

  if (!config.apiKey || !config.companyId) {
    return {
      success: false,
      error:   "Credenciais não configuradas. Verifique NFSE_GATEWAY_API_KEY e NFSE_COMPANY_ID no .env.",
    };
  }

  switch (config.provider) {
    case "nfseio":    return emitViaNfseIo(payload, config);
    case "nfeio":     return emitViaNfeio(payload, config);
    default:
      return { success: false, error: `Gateway "${config.provider}" não suportado. Use: nfseio | nfeio` };
  }
}
