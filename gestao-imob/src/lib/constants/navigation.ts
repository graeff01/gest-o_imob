export interface NavItem {
  title: string;
  href: string;
  icon: string;
  badge?: string;
  highlight?: boolean;
}

export const navigationItems: NavItem[] = [
  { title: "Painel", href: "/", icon: "LayoutDashboard" },
  { title: "Central IA", href: "/documentos", icon: "Sparkles", highlight: true },
  { title: "Caixa de Entrada", href: "/caixa-entrada", icon: "Inbox" },
  { title: "Saúde Operacional", href: "/saude", icon: "HeartPulse" },
  { title: "Contratos", href: "/contratos", icon: "FileText" },
  { title: "Financeiro", href: "/financeiro", icon: "DollarSign" },
  { title: "Extratos", href: "/extratos", icon: "CreditCard" },
  { title: "Notas Fiscais", href: "/notas-fiscais", icon: "Receipt" },
  { title: "Comissões", href: "/comissoes", icon: "Percent" },
  { title: "Folha de Pagamento", href: "/folha-corretores", icon: "Wallet" },
  { title: "Campanhas", href: "/campanhas", icon: "Trophy" },
  { title: "Pessoas", href: "/pessoas", icon: "Users" },
  { title: "Fornecedores", href: "/fornecedores", icon: "Store" },
  { title: "Proprietários", href: "/proprietarios", icon: "UserSquare" },
  { title: "Imóveis", href: "/imoveis", icon: "Building" },
  { title: "DIMOB", href: "/dimob", icon: "FileOutput" },
  { title: "Relatórios", href: "/relatorios", icon: "BarChart3" },
  { title: "Parâmetros", href: "/configuracoes", icon: "Settings2" },
  { title: "Auditoria", href: "/auditoria", icon: "Shield" },
];
