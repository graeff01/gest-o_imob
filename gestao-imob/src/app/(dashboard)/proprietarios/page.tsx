"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Building2, Loader2, RefreshCw, Search, UserSquare, Users } from "lucide-react";
import { PageShell, Stat } from "@/components/shared/page-shell";
import { formatCNPJ, formatCPF } from "@/lib/utils";

interface Owner {
  id: string;
  name: string;
  cpf_cnpj: string;
  person_type: string;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_pix: string | null;
}

export default function ProprietariosPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOwners = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "100" });
    if (query.trim()) params.set("search", query.trim());
    try {
      const response = await fetch(`/api/property-owners?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar proprietarios.");
      setOwners(data.owners ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar proprietarios reais.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchOwners();
  }, [fetchOwners]);

  function formatDoc(owner: Owner) {
    return owner.person_type === "PJ" || owner.cpf_cnpj.replace(/\D/g, "").length === 14
      ? formatCNPJ(owner.cpf_cnpj)
      : formatCPF(owner.cpf_cnpj);
  }

  return (
    <PageShell
      title="Proprietarios"
      description="Consulta operacional dos proprietarios reais que alimentam imoveis, contratos, repasses e DIMOB."
      icon={UserSquare}
      actions={
        <>
          <button
            onClick={fetchOwners}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
          <Link href="/pessoas" className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Users className="h-4 w-4" />
            Gerir em Pessoas
          </Link>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="Proprietarios reais" value={loading ? "..." : total} color="blue" />
        <Stat label="Pessoa fisica" value={loading ? "..." : owners.filter((owner) => owner.person_type === "PF").length} color="emerald" />
        <Stat label="Pessoa juridica" value={loading ? "..." : owners.filter((owner) => owner.person_type === "PJ").length} color="amber" />
        <Stat label="Com dados bancarios" value={loading ? "..." : owners.filter((owner) => owner.bank_name || owner.bank_pix).length} color="gray" />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Nao foi possivel carregar proprietarios reais.</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") fetchOwners(); }}
              placeholder="Buscar por nome ou CPF/CNPJ..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando proprietarios...
          </div>
        ) : owners.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">Nenhum proprietario cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Nome</th>
                  <th className="px-4 py-3 text-left">Documento</th>
                  <th className="px-4 py-3 text-left">Contato</th>
                  <th className="px-4 py-3 text-left">Dados bancarios</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {owners.map((owner) => (
                  <tr key={owner.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <p className="font-medium text-gray-900">{owner.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{formatDoc(owner)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <p>{owner.phone || "-"}</p>
                      <p className="text-xs text-gray-400">{owner.email || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <p>{owner.bank_name || "-"}</p>
                      <p className="text-xs text-gray-400">{owner.bank_pix ? `PIX: ${owner.bank_pix}` : "PIX nao informado"}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
