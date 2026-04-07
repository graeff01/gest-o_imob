"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Command,
  LayoutDashboard,
  FileText,
  DollarSign,
  Receipt,
  Wallet,
  Users,
  Building,
  Settings2,
  Shield,
  Inbox,
  HeartPulse,
  Sparkles,
  CreditCard,
  Trophy,
  Percent,
  FileOutput,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import type { Role } from "@/lib/constants/navigation";

interface SearchResult {
  id: string;
  type: "page" | "action";
  title: string;
  subtitle?: string;
  href: string;
  icon: React.ElementType;
  roles?: Role[];
}

const PAGES: SearchResult[] = [
  { id: "p-painel", type: "page", title: "Painel", subtitle: "Dashboard executivo", href: "/", icon: LayoutDashboard },
  { id: "p-ia", type: "page", title: "Central IA", subtitle: "Hub de upload e classificação", href: "/documentos", icon: Sparkles },
  { id: "p-caixa", type: "page", title: "Caixa de Entrada", subtitle: "Fila de exceções", href: "/caixa-entrada", icon: Inbox, roles: ["ADMIN_MASTER"] },
  { id: "p-saude", type: "page", title: "Saúde Operacional", subtitle: "Checagens automáticas", href: "/saude", icon: HeartPulse, roles: ["ADMIN_MASTER"] },
  { id: "p-contratos", type: "page", title: "Contratos", href: "/contratos", icon: FileText },
  { id: "p-financeiro", type: "page", title: "Financeiro", href: "/financeiro", icon: DollarSign },
  { id: "p-extratos", type: "page", title: "Extratos", subtitle: "Caixa e Pipeimob", href: "/extratos", icon: CreditCard },
  { id: "p-nf", type: "page", title: "Notas Fiscais", href: "/notas-fiscais", icon: Receipt },
  { id: "p-comissoes", type: "page", title: "Comissões", href: "/comissoes", icon: Percent },
  { id: "p-folha", type: "page", title: "Folha de Pagamento", href: "/folha-corretores", icon: Wallet },
  { id: "p-campanhas", type: "page", title: "Campanhas", href: "/campanhas", icon: Trophy },
  { id: "p-pessoas", type: "page", title: "Pessoas", href: "/pessoas", icon: Users },
  { id: "p-imoveis", type: "page", title: "Imóveis", href: "/imoveis", icon: Building },
  { id: "p-config", type: "page", title: "Parâmetros do Sistema", subtitle: "Configurações", href: "/configuracoes", icon: Settings2, roles: ["ADMIN_MASTER"] },
  { id: "p-auditoria", type: "page", title: "Auditoria", subtitle: "Log imutável", href: "/auditoria", icon: Shield, roles: ["ADMIN_MASTER"] },
  { id: "p-dimob", type: "page", title: "DIMOB", href: "/dimob", icon: FileOutput },
  { id: "p-relatorios", type: "page", title: "Relatórios", href: "/relatorios", icon: BarChart3 },
];

export function GlobalSearch() {
  const router = useRouter();
  const { data: session } = useSession();
  const role: Role = ((session?.user as { role?: Role })?.role) || "DONO";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  // Atalho Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results: SearchResult[] = useMemo(() => {
    if (!open) return [];
    const q = query.toLowerCase().trim();

    const visiblePages = PAGES.filter((p) => !p.roles || p.roles.includes(role));
    const all = [...visiblePages];
    if (!q) return all.slice(0, 8);
    return all
      .filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.subtitle?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 12);
  }, [query, open, role]);

  useEffect(() => {
    setSelected(0);
  }, [query, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[selected];
      if (r) {
        router.push(r.href);
        setOpen(false);
        setQuery("");
      }
    }
  };

  return (
    <>
      {/* Trigger button (header) */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors w-64"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Buscar em tudo...</span>
        <kbd className="text-[10px] font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded">
          Ctrl K
        </kbd>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[10vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar páginas, fornecedores, proprietários..."
                className="flex-1 outline-none text-sm bg-transparent"
              />
              <kbd className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                ESC
              </kbd>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {results.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  Nenhum resultado para "{query}"
                </div>
              ) : (
                results.map((r, i) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        router.push(r.href);
                        setOpen(false);
                        setQuery("");
                      }}
                      onMouseEnter={() => setSelected(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        i === selected ? "bg-blue-50" : "hover:bg-gray-50"
                      )}
                    >
                      <div
                        className={cn(
                          "p-1.5 rounded",
                          i === selected ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                        {r.subtitle && (
                          <p className="text-[11px] text-gray-500 truncate">{r.subtitle}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 uppercase">{r.type}</span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between text-[10px] text-gray-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="bg-gray-100 px-1 rounded">↑↓</kbd> navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-gray-100 px-1 rounded">↵</kbd> abrir
                </span>
              </div>
              <span className="flex items-center gap-1">
                <Command className="h-3 w-3" /> busca global
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
