"use client";

import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/constants/navigation";
import { Bell } from "lucide-react";
import { GlobalSearch } from "@/components/shared/global-search";
import { environmentLabel, environmentName, isNonProduction } from "@/lib/app-env";

export function Header() {
  const pathname = usePathname();

  const currentItem = navigationItems.find(
    (item) =>
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(item.href))
  );

  const title = currentItem?.title || "Painel";

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 lg:px-8">
      <h1 className="text-lg font-semibold text-gray-900 lg:ml-0 ml-12">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        {isNonProduction && (
          <div
            className="hidden items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 sm:flex"
            title={`Ambiente de ${environmentName}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {environmentLabel}
          </div>
        )}
        <GlobalSearch />
        <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="h-6 w-px bg-gray-200" />
        <span className="text-xs text-gray-400">Moinhos de Vento</span>
      </div>
    </header>
  );
}
