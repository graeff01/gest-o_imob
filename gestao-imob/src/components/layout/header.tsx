"use client";

import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/constants/navigation";

export function Header() {
  const pathname = usePathname();

  const currentItem = navigationItems.find(
    (item) =>
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(item.href))
  );

  const title = currentItem?.title || "Dashboard";

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center px-6 lg:px-8">
      <h1 className="text-lg font-semibold text-gray-900 lg:ml-0 ml-12">
        {title}
      </h1>
    </header>
  );
}
