import type { Role } from "@/lib/auth";

type RouteRule = {
  prefix: string;
  roles: Role[];
};

export const technicalRouteRules: RouteRule[] = [
  { prefix: "/saude", roles: ["ADMIN_MASTER"] },
  { prefix: "/configuracoes", roles: ["ADMIN_MASTER"] },
  { prefix: "/auditoria", roles: ["ADMIN_MASTER"] },
  { prefix: "/release-atual", roles: ["ADMIN_MASTER"] },
];

export function canAccessRoute(pathname: string, role: Role) {
  const rule = technicalRouteRules.find((candidate) => pathname === candidate.prefix || pathname.startsWith(`${candidate.prefix}/`));
  if (!rule) return true;
  return rule.roles.includes(role);
}
