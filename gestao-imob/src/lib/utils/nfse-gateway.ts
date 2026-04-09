/**
 * nfse-gateway.ts
 * ---------------
 * Abstração sobre o gateway de emissão de NFS-e.
 *
 * ESTADO ATUAL: STUB — retorna sucesso simulado.
 * Para ativar a emissão real, siga os passos abaixo.
 *
 * ─── COMO ATIVAR O GATEWAY (quando tiver o certificado) ───────────────────────
 *
 * 1. Escolha o gateway (recomendado: NFe.io ou Plugnotas)
 * 2. Crie uma conta e cadastre a empresa com o certificado digital A1
 * 3. Adicione as variáveis no .env (e no Railway em Prod):
 *
 *    NFSE_GATEWAY_PROVIDER=nfeio          # ou: plugnotas | focusnfe
 *    NFSE_GATEWAY_API_KEY=sua_chave_aqui
 *    NFSE_COMPANY_ID=id_da_empresa_no_gateway
 *    NFSE_CITY_CODE=4314902              # Código IBGE de Porto Alegre
 *    NFSE_SERVICE_CODE=6822600           # Código de serviço imobiliário LC116
 *    NFSE_ISSQN_RATE=0.02               # Alíquota ISS POA (confirmar com contador)
 *
 * 4. Troque GATEWAY_STUB_MODE=true para GATEWAY_STUB_MODE=false no .env
 * 5. Teste com uma nota real em ambiente de homologação primeiro
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Esta camada isola 100% o código de negócio das particularidades de cada gateway.
 * Se trocar de gateway no futuro, só este arquivo muda.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface NfseEmitPayload {
  /** ID interno da nota no nosso banco — usado para rastreamento */
  invoiceId: string;

  /** Dados do tomador (quem recebe a nota) */
  borrower: {
    name: string;
    /** CPF (11 dígitos) ou CNPJ (14 dígitos) — apenas dígitos */
    federalTaxNumber: string;
    email?: string;
  };

  /** Dados do serviço prestado */
  service: {
    description: string;
    /** Valor em reais */
    amount: number;
    /** Competência: { month: 1-12, year: 2026 } */
    competence: { month: number; year: number };
  };
}

export interface NfseEmitSuccess {
  success: true;
  /** ID gerado pelo gateway — salvar no banco para rastreamento */
  gatewayId: string;
  /** Número oficial da NFS-e na prefeitura */
  nfseNumber: number | null;
  /** URL do PDF para download/arquivo */
  pdfUrl: string | null;
  /** URL do XML para arquivo fiscal */
  xmlUrl: string | null;
  /** Status retornado pelo gateway */
  gatewayStatus: string;
  /** Nome do gateway usado */
  provider: string;
}

export interface NfseEmitFailure {
  success: false;
  /** Mensagem de erro legível para o usuário */
  error: string;
  /** Código de erro do gateway (para debug) */
  gatewayErrorCode?: string;
}

export type NfseEmitResult = NfseEmitSuccess | NfseEmitFailure;

// ─── Configuração ─────────────────────────────────────────────────────────────

/**
 * Lê as configurações do gateway das variáveis de ambiente.
 * Modo stub ativo enquanto GATEWAY_STUB_MODE=true (padrão).
 */
function getGatewayConfig() {
  return {
    isStub: process.env.GATEWAY_STUB_MODE !== "false",
    provider: process.env.NFSE_GATEWAY_PROVIDER ?? "nfeio",
    apiKey: process.env.NFSE_GATEWAY_API_KEY ?? "",
    companyId: process.env.NFSE_COMPANY_ID ?? "",
    cityCode: process.env.NFSE_CITY_CODE ?? "4314902",     // Porto Alegre
    serviceCode: process.env.NFSE_SERVICE_CODE ?? "6822600", // Serviços imobiliários
    issqnRate: parseFloat(process.env.NFSE_ISSQN_RATE ?? "0.02"),
  };
}

// ─── Implementações por gateway ───────────────────────────────────────────────

/**
 * Emissão via NFe.io
 * Docs: https://nfe.io/docs/nfs-e/emissao-nota-fiscal/
 */
async function emitViaNfeio(
  payload: NfseEmitPayload,
  config: ReturnType<typeof getGatewayConfig>
): Promise<NfseEmitResult> {
  const url = `https://api.nfe.io/v1/companies/${config.companyId}/serviceinvoices`;

  const body = {
    cityServiceCode: config.serviceCode,
    issRate: config.issqnRate,
    servicesAmount: payload.service.amount,
    description: payload.service.description,
    competence: new Date(
      payload.service.competence.year,
      payload.service.competence.month - 1,
      1
    ).toISOString(),
    borrower: {
      name: payload.borrower.name,
      federalTaxNumber: payload.borrower.federalTaxNumber,
      email: payload.borrower.email,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "X-Request-Id": payload.invoiceId, // Para rastreamento e idempotência
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000), // 30s timeout
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro de conexão com o gateway.";
    return { success: false, error: `Falha ao conectar com NFe.io: ${message}` };
  }

  if (!response.ok) {
    let errorBody = "";
    try { errorBody = await response.text(); } catch { /* ignora */ }
    return {
      success: false,
      error: `NFe.io retornou erro ${response.status}: ${errorBody || response.statusText}`,
      gatewayErrorCode: String(response.status),
    };
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json() as Record<string, unknown>;
  } catch {
    return { success: false, error: "Resposta inválida do gateway NFe.io." };
  }

  return {
    success: true,
    gatewayId: String(data.id ?? ""),
    nfseNumber: data.number ? Number(data.number) : null,
    pdfUrl: (data.pdfUrl as string) ?? null,
    xmlUrl: (data.xmlUrl as string) ?? null,
    gatewayStatus: String(data.status ?? "processing"),
    provider: "nfeio",
  };
}

/**
 * Emissão via Plugnotas
 * Docs: https://docs.plugnotas.com.br/
 */
async function emitViaPlugnotas(
  payload: NfseEmitPayload,
  config: ReturnType<typeof getGatewayConfig>
): Promise<NfseEmitResult> {
  const url = "https://api.plugnotas.com.br/nfse";

  const body = {
    idIntegracao: payload.invoiceId, // Chave de idempotência
    prestador: { cnpj: config.companyId },
    tomador: {
      cpfCnpj: payload.borrower.federalTaxNumber,
      razaoSocial: payload.borrower.name,
      email: payload.borrower.email,
    },
    servico: {
      codigoTributacaoMunicipio: config.serviceCode,
      aliquota: config.issqnRate * 100, // Plugnotas usa percentual (ex: 2.0)
      valorServicos: payload.service.amount,
      discriminacao: payload.service.description,
      competencia: `${payload.service.competence.year}-${String(payload.service.competence.month).padStart(2, "0")}-01`,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro de conexão.";
    return { success: false, error: `Falha ao conectar com Plugnotas: ${message}` };
  }

  if (!response.ok) {
    let errorBody = "";
    try { errorBody = await response.text(); } catch { /* ignora */ }
    return {
      success: false,
      error: `Plugnotas retornou erro ${response.status}: ${errorBody || response.statusText}`,
      gatewayErrorCode: String(response.status),
    };
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json() as Record<string, unknown>;
  } catch {
    return { success: false, error: "Resposta inválida do gateway Plugnotas." };
  }

  return {
    success: true,
    gatewayId: String(data.id ?? ""),
    nfseNumber: data.numero ? Number(data.numero) : null,
    pdfUrl: (data.linkPdf as string) ?? null,
    xmlUrl: (data.linkXml as string) ?? null,
    gatewayStatus: String(data.status ?? "processing"),
    provider: "plugnotas",
  };
}

/**
 * Modo stub — retorna sucesso simulado sem chamar nenhuma API externa.
 * Ativo enquanto GATEWAY_STUB_MODE=true no .env.
 *
 * Gera um ID falso para simular o comportamento esperado em desenvolvimento.
 */
function emitStub(payload: NfseEmitPayload): NfseEmitResult {
  console.warn(
    `[nfse-gateway] MODO STUB ATIVO — nota ${payload.invoiceId} NÃO foi enviada à prefeitura.`,
    "Configure GATEWAY_STUB_MODE=false e as credenciais no .env para emissão real."
  );

  return {
    success: true,
    gatewayId: `stub-${payload.invoiceId}-${Date.now()}`,
    nfseNumber: null,
    pdfUrl: null,
    xmlUrl: null,
    gatewayStatus: "stub_success",
    provider: "stub",
  };
}

// ─── Função pública ───────────────────────────────────────────────────────────

/**
 * Emite uma NFS-e via o gateway configurado.
 *
 * Em modo stub (padrão), simula o envio sem chamar API externa.
 * Para emissão real, configure as variáveis de ambiente do gateway.
 *
 * @param payload - Dados da nota a emitir
 * @returns NfseEmitResult com sucesso ou erro detalhado
 */
export async function emitNfse(payload: NfseEmitPayload): Promise<NfseEmitResult> {
  const config = getGatewayConfig();

  // Modo stub — desenvolvimento e testes sem gateway
  if (config.isStub) {
    return emitStub(payload);
  }

  // Validação das credenciais antes de tentar emitir
  if (!config.apiKey || !config.companyId) {
    return {
      success: false,
      error: "Credenciais do gateway não configuradas. Verifique NFSE_GATEWAY_API_KEY e NFSE_COMPANY_ID no .env.",
    };
  }

  // Roteamento para o gateway configurado
  switch (config.provider) {
    case "nfeio":
      return emitViaNfeio(payload, config);
    case "plugnotas":
      return emitViaPlugnotas(payload, config);
    default:
      return {
        success: false,
        error: `Gateway "${config.provider}" não suportado. Use: nfeio | plugnotas`,
      };
  }
}
