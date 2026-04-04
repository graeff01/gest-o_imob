export interface NavItem {
  title: string;
  href: string;
  icon: string;
  badge?: string;
}

export const navigationItems: NavItem[] = [
  { title: "Painel", href: "/", icon: "LayoutDashboard" },
  { title: "Contratos", href: "/contratos", icon: "FileText" },
  { title: "Financeiro", href: "/financeiro", icon: "DollarSign" },
  { title: "Extratos", href: "/extratos", icon: "CreditCard" },
  { title: "Notas Fiscais", href: "/notas-fiscais", icon: "Receipt" },
  { title: "Comissões", href: "/comissoes", icon: "Percent" },
  { title: "Folha de Pagamento", href: "/folha-corretores", icon: "Wallet" },
  { title: "Campanhas", href: "/campanhas", icon: "Trophy" },
  { title: "Pessoas", href: "/pessoas", icon: "Users" },
  { title: "Imóveis", href: "/imoveis", icon: "Building" },
  { title: "Documentos", href: "/documentos", icon: "Upload" },
  { title: "DIMOB", href: "/dimob", icon: "FileOutput" },
  { title: "Relatórios", href: "/relatorios", icon: "BarChart3" },
];
