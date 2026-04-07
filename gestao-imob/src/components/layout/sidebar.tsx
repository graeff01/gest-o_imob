"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  DollarSign,
  Percent,
  Wallet,
  Upload,
  BarChart3,
  LogOut,
  Menu,
  X,
  FileOutput,
  Calculator,
  Building2,
  CreditCard,
  Receipt,
  Trophy,
  Users,
  Building,
  Sparkles,
  Inbox,
  HeartPulse,
  Store,
  UserSquare,
  Settings2,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navigationItems, SECTION_LABELS, type NavItem, type Role } from "@/lib/constants/navigation";
import { useState } from "react";
import { Crown, ShieldCheck } from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  FileText,
  DollarSign,
  Percent,
  Wallet,
  Upload,
  BarChart3,
  FileOutput,
  Calculator,
  CreditCard,
  Receipt,
  Trophy,
  Users,
  Building,
  Sparkles,
  Inbox,
  HeartPulse,
  Store,
  UserSquare,
  Settings2,
  Shield,
};

interface SidebarProps {
  userName: string;
  role: Role;
}

export function Sidebar({ userName, role }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Filtra itens conforme o perfil ativo
  const visibleItems = navigationItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  // Agrupa por seção mantendo ordem
  const sections: Array<{ key: NavItem["section"]; items: NavItem[] }> = [];
  visibleItems.forEach((item) => {
    const key = item.section || "main";
    const existing = sections.find((s) => s.key === key);
    if (existing) existing.items.push(item);
    else sections.push({ key, items: [item] });
  });

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Moinhos de Vento</h2>
            <p className="text-[11px] text-gray-400">Gestão Financeira</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {sections.map((section, sIdx) => (
          <div key={section.key || "main"} className={cn(sIdx > 0 && "mt-4")}>
            {section.key && (
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 pt-2 pb-2">
                {SECTION_LABELS[section.key]}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
          const Icon = iconMap[item.icon] || LayoutDashboard;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          if (item.highlight) {
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all relative group",
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25"
                    : "bg-gradient-to-r from-blue-600/10 to-indigo-600/10 text-blue-400 hover:from-blue-600/20 hover:to-indigo-600/20 hover:text-blue-300"
                )}
              >
                <div className={cn(
                  "p-1 rounded-md",
                  isActive ? "bg-white/20" : "bg-blue-500/20"
                )}>
                  <Icon className="h-4 w-4 flex-shrink-0" />
                </div>
                <span className="flex-1">{item.title}</span>
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-blue-500/20 text-blue-400 animate-pulse"
                )}>
                  IA
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              <span className="flex-1">{item.title}</span>
              {item.badge && (
                <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="p-3 border-t border-gray-800">
        <div className="px-3 py-2 mb-1 flex items-center gap-2 rounded-lg bg-gray-800/40">
          {role === "ADMIN_MASTER" ? (
            <ShieldCheck className="h-4 w-4 text-amber-400 flex-shrink-0" />
          ) : (
            <Crown className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-[9px] text-gray-500 uppercase tracking-wider">Perfil</p>
            <p className="text-xs font-semibold text-white truncate">
              {role === "ADMIN_MASTER" ? "Admin Master" : "Dono"}
            </p>
          </div>
        </div>

        <div className="px-3 py-2 flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-300">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-300 font-medium truncate">{userName}</p>
            <p className="text-[11px] text-gray-500">
              {role === "ADMIN_MASTER" ? "Administrador" : "Proprietário"}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors w-full mt-1"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - mobile */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 transform transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-gray-900">
        {sidebarContent}
      </aside>
    </>
  );
}
