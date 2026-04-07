"use client";

import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/constants/navigation";
import { Bell } from "lucide-react";
import { GlobalSearch } from "@/components/shared/global-search";

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
