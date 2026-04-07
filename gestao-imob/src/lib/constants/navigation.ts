export type Role = "ADMIN_MASTER" | "DONO";

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  badge?: string;
  highlight?: boolean;
  /** Perfis que veem este item. Se omitido, todos veem. */
  roles?: Role[];
  /** Seção do menu (separa visualmente) */
  section?: "main" | "operacao" | "cadastros" | "sistema";
}

export const navigationItems: NavItem[] = [
  // ─── Principal — todos veem ───
  { title: "Painel", href: "/", icon: "LayoutDashboard", section: "main" },
  { title: "Central IA", href: "/documentos", icon: "Sparkles", highlight: true, section: "main" },

  // ─── Operação — todos veem ───
  { title: "Contratos", href: "/contratos", icon: "FileText", section: "operacao" },
  { title: "Financeiro", href: "/financeiro", icon: "DollarSign", section: "operacao" },
  { title: "Extratos", href: "/extratos", icon: "CreditCard", section: "operacao" },
  { title: "Notas Fiscais", href: "/notas-fiscais", icon: "Receipt", section: "operacao" },
  { title: "Comissões", href: "/comissoes", icon: "Percent", section: "operacao" },
  { title: "Folha de Pagamento", href: "/folha-corretores", icon: "Wallet", section: "operacao" },
  { title: "Campanhas", href: "/campanhas", icon: "Trophy", section: "operacao" },
  { title: "Relatórios", href: "/relatorios", icon: "BarChart3", section: "operacao" },

  // ─── Cadastros — todos veem ───
  { title: "Pessoas", href: "/pessoas", icon: "Users", section: "cadastros" },
  { title: "Imóveis", href: "/imoveis", icon: "Building", section: "cadastros" },
  { title: "DIMOB", href: "/dimob", icon: "FileOutput", section: "cadastros" },

  // ─── Sistema — só ADMIN_MASTER ───
  { title: "Caixa de Entrada", href: "/caixa-entrada", icon: "Inbox", section: "sistema", roles: ["ADMIN_MASTER"] },
  { title: "Saúde Operacional", href: "/saude", icon: "HeartPulse", section: "sistema", roles: ["ADMIN_MASTER"] },
  { title: "Parâmetros", href: "/configuracoes", icon: "Settings2", section: "sistema", roles: ["ADMIN_MASTER"] },
  { title: "Auditoria", href: "/auditoria", icon: "Shield", section: "sistema", roles: ["ADMIN_MASTER"] },
];

export const SECTION_LABELS: Record<NonNullable<NavItem["section"]>, string> = {
  main: "Principal",
  operacao: "Operação",
  cadastros: "Cadastros",
  sistema: "Sistema & Segurança",
};
