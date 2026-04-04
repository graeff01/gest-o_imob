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
  { title: "Regras de Comissão", href: "/comissoes", icon: "Percent" },
  { title: "Folha de Pagamento", href: "/folha-corretores", icon: "Wallet", badge: "NOVO" },
  { title: "DIMOB", href: "/dimob", icon: "FileOutput", badge: "NOVO" },
  { title: "Documentos", href: "/documentos", icon: "Upload" },
  { title: "Relatórios", href: "/relatorios", icon: "BarChart3" },
];
