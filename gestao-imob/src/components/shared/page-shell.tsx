"use client";

import { cn } from "@/lib/utils";

/**
 * PageShell — header padrão de página corporativa.
 * Padroniza título, descrição e área de ações das páginas da Fase A.
 */
export function PageShell({
  title,
  description,
  icon: Icon,
  actions,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <Icon className="h-5 w-5 text-blue-600" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
      <Icon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  color = "gray",
}: {
  label: string;
  value: string | number;
  color?: "gray" | "blue" | "emerald" | "amber" | "rose";
}) {
  const colors = {
    gray: "text-gray-900",
    blue: "text-blue-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={cn("text-xl font-bold", colors[color])}>{value}</p>
    </div>
  );
}
