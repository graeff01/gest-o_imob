export interface NavItem {
  title: string;
  href: string;
  icon: string;
}

export const navigationItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: "LayoutDashboard" },
  { title: "Contratos", href: "/contratos", icon: "FileText" },
  { title: "Financeiro", href: "/financeiro", icon: "DollarSign" },
  { title: "Comissoes", href: "/comissoes", icon: "Percent" },
  { title: "Notas Fiscais", href: "/notas-fiscais", icon: "Receipt" },
  { title: "Folha", href: "/folha", icon: "Wallet" },
  { title: "Campanhas", href: "/campanhas", icon: "Trophy" },
  { title: "Pessoas", href: "/pessoas", icon: "Users" },
  { title: "Imoveis", href: "/imoveis", icon: "Building2" },
  { title: "Envios", href: "/envios", icon: "Upload" },
  { title: "Relatorios", href: "/relatorios", icon: "BarChart3" },
];
