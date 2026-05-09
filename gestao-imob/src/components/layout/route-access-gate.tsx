"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/auth";
import { canAccessRoute } from "@/lib/route-access";

export function RouteAccessGate({ role }: { role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = canAccessRoute(pathname, role);

  useEffect(() => {
    if (!allowed) {
      router.replace("/");
    }
  }, [allowed, router]);

  if (allowed) return null;

  return (
    <div className="p-6 text-sm text-gray-500">
      Validando permissao de acesso.
    </div>
  );
}
