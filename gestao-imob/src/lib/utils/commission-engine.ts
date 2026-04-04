/**
 * MOTOR DE CÁLCULO DE COMISSÕES - AUXILIADORA PREDIAL (CONFORME DOCX)
 * Centraliza as regras de negócio para evitar erros de cálculo manuais.
 */

export interface CalculationResult {
  faturamentoBruto: number;
  impostos: number;
  repasseMatriz: number;
  saldoAgencia: number;
  comissaoCorretor: number;
  bonusAgencItem: number;
  lucroLiquidoEstimado: number;
}

export const COMMISSION_RULES = {
  TAX_RATE: 0.09, // 9% retenção
  FRANCHISE_SHARE: 0.70, // 70% para a matriz
  LISTING_BONUS: 50, // R$ 50 por captação perfil
  
  // Tiers para Consultores (Leases)
  CONSULTOR_TIERS: [
    { min: 0, max: 3, rate: 0.10 },
    { min: 4, max: 9, rate: 0.11 },
    { min: 10, max: 999, rate: 0.13 }
  ],

  // Tiers para Agenciadores (Listings)
  AGENCIADOR_TIERS: [
    { min: 0, max: 15, rate: 0.10 },
    { min: 16, max: 20, rate: 0.11 },
    { min: 21, max: 999, rate: 0.13 }
  ]
};

/**
 * Calcula quanto o corretor deve receber por uma locação específica 
 * considerando a produção total dele no mês (Tiers).
 */
export function calculateCommission(
  valorAluguel: number,
  totalLocacoesNoMes: number,
  isAgenciamento: boolean = false,
  totalCaptacoesNoMes: number = 0,
  isProfileListing: boolean = false
): CalculationResult {
  
  const faturamentoBruto = valorAluguel;
  const impostos = faturamentoBruto * COMMISSION_RULES.TAX_RATE;
  const repasseMatriz = faturamentoBruto * COMMISSION_RULES.FRANCHISE_SHARE;
  const saldoAgencia = faturamentoBruto - repasseMatriz;

  let comissaoCorretor = 0;
  let bonusAgencItem = 0;

  if (isAgenciamento) {
    // Regra de Agenciador (DOCX)
    const tier = COMMISSION_RULES.AGENCIADOR_TIERS.find(t => totalCaptacoesNoMes >= t.min && totalCaptacoesNoMes <= t.max);
    const rate = tier?.rate || 0.10;
    comissaoCorretor = faturamentoBruto * rate;
    if (isProfileListing) {
      bonusAgencItem = COMMISSION_RULES.LISTING_BONUS;
    }
  } else {
    // Regra de Consultor (DOCX)
    const tier = COMMISSION_RULES.CONSULTOR_TIERS.find(t => totalLocacoesNoMes >= t.min && totalLocacoesNoMes <= t.max);
    const rate = tier?.rate || 0.10;
    comissaoCorretor = faturamentoBruto * rate;
  }

  const lucroLiquidoEstimado = saldoAgencia - comissaoCorretor - bonusAgencItem;

  return {
    faturamentoBruto,
    impostos,
    repasseMatriz,
    saldoAgencia,
    comissaoCorretor,
    bonusAgencItem,
    lucroLiquidoEstimado
  };
}
