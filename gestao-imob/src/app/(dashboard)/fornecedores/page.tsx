"use client";

import { useEffect, useState } from "react";
import { Store, Plus, Pencil, Trash2, X, Search, Sparkles } from "lucide-react";
import { PageShell, EmptyState, Stat } from "@/components/shared/page-shell";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Fornecedor,
  getFornecedores,
  saveFornecedor,
  deleteFornecedor,
} from "@/lib/stores/core-store";

const CATEGORIAS = [
  "Administrativo",
  "Operacional",
  "Comercial",
  "Tecnologia",
  "Marketing",
  "Folha",
  "Tributos",
  "Outros",
];

const EMPTY: Omit<Fornecedor, "id" | "criadoEm" | "atualizadoEm"> = {
  nome: "",
  cpfCnpj: "",
  categoriaPadrao: "",
  subcategoriaPadrao: "",
  confiancaClassificacao: 0,
  totalMovimentado: 0,
  quantidadeLancamentos: 0,
  observacoes: "",
};

export default function FornecedoresPage() {
  const [list, setList] = useState<Fornecedor[]>([]);
  const [editing, setEditing] = useState<(Fornecedor | typeof EMPTY) | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setList(getFornecedores());
  }, []);

  const refresh = () => setList(getFornecedores());

  const handleSave = (f: Fornecedor | typeof EMPTY) => {
    if (!f.nome.trim()) return;
    saveFornecedor(f as Fornecedor);
    refresh();
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Remover este fornecedor?")) return;
    deleteFornecedor(id);
    refresh();
  };

  const filtered = list.filter(
    (f) =>
      f.nome.toLowerCase().includes(query.toLowerCase()) ||
      f.cpfCnpj.includes(query)
  );

  const totalMovimentado = list.reduce((s, f) => s + f.totalMovimentado, 0);
  const totalComRegra = list.filter((f) => f.categoriaPadrao).length;

  return (
    <PageShell
      title="Fornecedores"
      description="Entidades que emitem despesas — base para classificação automática por IA"
      icon={Store}
      actions={
        <button
          onClick={() => setEditing(EMPTY)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" /> Novo fornecedor
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total de fornecedores" value={list.length} />
        <Stat label="Com regra de classificação" value={totalComRegra} color="blue" />
        <Stat label="Total movimentado" value={formatCurrency(totalMovimentado)} color="emerald" />
        <Stat
          label="Cobertura IA"
          value={list.length > 0 ? `${Math.round((totalComRegra / list.length) * 100)}%` : "—"}
          color="amber"
        />
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700">
          <p className="font-medium mb-0.5">Como funciona a classificação automática</p>
          <p className="text-blue-600/80">
            Ao cadastrar uma categoria padrão para o fornecedor, próximas despesas identificadas pela IA
            (via Central IA) serão classificadas automaticamente nessa categoria. Quanto maior o número
            de lançamentos confirmados, maior a confiança da IA nas próximas sugestões.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou CNPJ..."
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Store}
            title="Nenhum fornecedor cadastrado"
            description="Cadastre fornecedores para permitir que a IA classifique despesas automaticamente ao processar documentos."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">CPF/CNPJ</th>
                <th className="px-4 py-3 text-left">Categoria padrão</th>
                <th className="px-4 py-3 text-right">Lançamentos</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Confiança IA</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{f.nome}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{f.cpfCnpj}</td>
                  <td className="px-4 py-3">
                    {f.categoriaPadrao ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {f.categoriaPadrao}
                        {f.subcategoriaPadrao ? ` / ${f.subcategoriaPadrao}` : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">não definida</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{f.quantidadeLancamentos}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(f.totalMovimentado)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            f.confiancaClassificacao >= 80
                              ? "bg-green-500"
                              : f.confiancaClassificacao >= 40
                              ? "bg-amber-500"
                              : "bg-gray-300"
                          )}
                          style={{ width: `${Math.min(f.confiancaClassificacao, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500">{f.confiancaClassificacao}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(f)}
                        className="p-1.5 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <FornecedorModal
          fornecedor={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </PageShell>
  );
}

function FornecedorModal({
  fornecedor,
  onSave,
  onClose,
}: {
  fornecedor: Fornecedor | typeof EMPTY;
  onSave: (f: Fornecedor | typeof EMPTY) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(fornecedor);
  const isNew = !("id" in form) || !form.id;

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            {isNew ? "Novo fornecedor" : "Editar fornecedor"}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nome / Razão Social</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => update("nome", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">CPF / CNPJ</label>
            <input
              type="text"
              value={form.cpfCnpj}
              onChange={(e) => update("cpfCnpj", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Categoria padrão</label>
              <select
                value={form.categoriaPadrao || ""}
                onChange={(e) => update("categoriaPadrao", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">— selecionar —</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Subcategoria</label>
              <input
                type="text"
                value={form.subcategoriaPadrao || ""}
                onChange={(e) => update("subcategoriaPadrao", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Observações</label>
            <textarea
              value={form.observacoes || ""}
              onChange={(e) => update("observacoes", e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
