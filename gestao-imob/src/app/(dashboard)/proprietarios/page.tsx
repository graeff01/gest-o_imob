"use client";

import { useEffect, useState } from "react";
import { UserSquare, Plus, Pencil, Trash2, X, Search, Building } from "lucide-react";
import { PageShell, EmptyState, Stat } from "@/components/shared/page-shell";
import {
  Proprietario,
  getProprietarios,
  saveProprietario,
  deleteProprietario,
} from "@/lib/stores/core-store";

const EMPTY: Omit<Proprietario, "id" | "criadoEm" | "atualizadoEm"> = {
  nome: "",
  cpfCnpj: "",
  telefone: "",
  email: "",
  pix: "",
  banco: "",
  agencia: "",
  conta: "",
  imoveisIds: [],
  observacoes: "",
};

export default function ProprietariosPage() {
  const [list, setList] = useState<Proprietario[]>([]);
  const [editing, setEditing] = useState<(Proprietario | typeof EMPTY) | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setList(getProprietarios());
  }, []);

  const refresh = () => setList(getProprietarios());

  const handleSave = (p: Proprietario | typeof EMPTY) => {
    if (!p.nome.trim()) return;
    saveProprietario(p as Proprietario);
    refresh();
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Remover este proprietário?")) return;
    deleteProprietario(id);
    refresh();
  };

  const filtered = list.filter(
    (p) =>
      p.nome.toLowerCase().includes(query.toLowerCase()) ||
      p.cpfCnpj.includes(query)
  );

  const totalImoveis = list.reduce((s, p) => s + p.imoveisIds.length, 0);
  const semContato = list.filter((p) => !p.telefone && !p.email).length;

  return (
    <PageShell
      title="Proprietários"
      description="Donos dos imóveis sob administração — base para repasses e relacionamento"
      icon={UserSquare}
      actions={
        <button
          onClick={() => setEditing(EMPTY)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" /> Novo proprietário
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Proprietários cadastrados" value={list.length} />
        <Stat label="Imóveis vinculados" value={totalImoveis} color="blue" />
        <Stat label="Sem contato registrado" value={semContato} color="amber" />
        <Stat
          label="Com PIX cadastrado"
          value={list.filter((p) => p.pix).length}
          color="emerald"
        />
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
            icon={UserSquare}
            title="Nenhum proprietário cadastrado"
            description="Cadastre os donos dos imóveis para vincular contratos, repasses e relatórios."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">CPF/CNPJ</th>
                <th className="px-4 py-3 text-left">Contato</th>
                <th className="px-4 py-3 text-center">Imóveis</th>
                <th className="px-4 py-3 text-left">PIX</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.cpfCnpj}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {p.telefone && <div>{p.telefone}</div>}
                    {p.email && <div className="text-gray-400">{p.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                      <Building className="h-3 w-3" />
                      {p.imoveisIds.length}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 truncate max-w-[140px]">
                    {p.pix || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        className="p-1.5 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
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
        <ProprietarioModal
          proprietario={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </PageShell>
  );
}

function ProprietarioModal({
  proprietario,
  onSave,
  onClose,
}: {
  proprietario: Proprietario | typeof EMPTY;
  onSave: (p: Proprietario | typeof EMPTY) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(proprietario);
  const isNew = !("id" in form) || !form.id;

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-900">
            {isNew ? "Novo proprietário" : "Editar proprietário"}
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
              <label className="block text-xs text-gray-500 mb-1">Telefone</label>
              <input
                type="text"
                value={form.telefone || ""}
                onChange={(e) => update("telefone", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={form.email || ""}
                onChange={(e) => update("email", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">Dados bancários (repasse)</p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">PIX</label>
              <input
                type="text"
                value={form.pix || ""}
                onChange={(e) => update("pix", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Banco</label>
                <input
                  type="text"
                  value={form.banco || ""}
                  onChange={(e) => update("banco", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Agência</label>
                <input
                  type="text"
                  value={form.agencia || ""}
                  onChange={(e) => update("agencia", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Conta</label>
                <input
                  type="text"
                  value={form.conta || ""}
                  onChange={(e) => update("conta", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
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

        <div className="flex justify-end gap-2 p-5 border-t border-gray-200 sticky bottom-0 bg-white">
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
