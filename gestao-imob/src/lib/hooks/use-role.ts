"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/constants/navigation";

const KEY = "active-role-v1";

/**
 * Hook de perfil ativo. Persistido em localStorage até o auth real ser conectado.
 * Default: ADMIN_MASTER (visão completa).
 */
export function useRole(): [Role, (r: Role) => void] {
  const [role, setRoleState] = useState<Role>("ADMIN_MASTER");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(KEY) as Role | null;
    if (saved === "ADMIN_MASTER" || saved === "DONO") {
      setRoleState(saved);
    }
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    if (typeof window !== "undefined") {
      localStorage.setItem(KEY, r);
      // força recarregar para reconfigurar sidebar/header
      window.location.reload();
    }
  };

  return [role, setRole];
}
