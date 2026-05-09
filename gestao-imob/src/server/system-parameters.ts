import "server-only";
import { prisma } from "@/lib/prisma";
import { ensureFoundationSchema } from "@/server/foundation-schema";

export interface BusinessParameters {
  inadimplenciaDiasCriticos: number;
  comissaoPadraoLocacao: number;
  comissaoPadraoVenda: number;
  permitirBaixaManualSemExtrato: boolean;
}

const DEFAULT_BUSINESS_PARAMETERS: BusinessParameters = {
  inadimplenciaDiasCriticos: 7,
  comissaoPadraoLocacao: 10,
  comissaoPadraoVenda: 5,
  permitirBaixaManualSemExtrato: true,
};

export async function getBusinessParameters(): Promise<BusinessParameters> {
  await ensureFoundationSchema();

  const current = await prisma.systemParameterVersion.findFirst({
    where: { scope: "business", is_active: true },
    orderBy: { version: "desc" },
    select: { payload: true },
  });

  if (!current?.payload || typeof current.payload !== "object" || Array.isArray(current.payload)) {
    return DEFAULT_BUSINESS_PARAMETERS;
  }

  return {
    ...DEFAULT_BUSINESS_PARAMETERS,
    ...(current.payload as Partial<BusinessParameters>),
  };
}

export { DEFAULT_BUSINESS_PARAMETERS };
