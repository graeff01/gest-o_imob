"use client";

import { useState, useMemo } from "react";
import {
  Wallet,
  Plus,
  User,
  X,
  Zap,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { calculateCommission } from "@/lib/utils/commission-engine";

type Tab = "operations" | "preview";

interface Operation {
  id: string;
  corretorId: string;
  tipo: "LOCACAO" | "AGENCIAMENTO";
  valorAluguel: number;
  isProfileListing?: boolean;
}

interface Corretor {
  id: string;
  nome: string;
  tipo: "CLT" | "PJ" | "AUTÔNOMO";
  pix: string;
}

const INITIAL_CORRETORES: Corretor[] = [
  { id: "1", nome: "Lucas Rodrigues", tipo: "CLT", pix: "lucas@imobiliaria.com" },
  { id: "2", nome: "Fernanda Oliveira", tipo: "PJ", pix: "fernanda.pj@gmail.com" },
  { id: "3", nome: "Rafael Souza", tipo: "PJ", pix: "rafael.souza@gmail.com" },
];

const INITIAL_OPERATIONS: Operation[] = [
  { id: "op1", corretorId: "1", tipo: "LOCACAO", valorAluguel: 2500 },
  { id: "op2", corretorId: "1", tipo: "LOCACAO", valorAluguel: 3200 },
  { id: "op3", corretorId: "2", tipo: "AGENCIAMENTO", valorAluguel: 5000, isProfileListing: true },
];

export default function FolhaCorretoresPage() {
  const [activeTab, setActiveTab] = useState<Tab>("operations");
  const [operations, setOperations] = useState<Operation[]>(INITIAL_OPERATIONS);
  const [corretores] = useState<Corretor[]>(INITIAL_CORRETORES);

  const [showModal, setShowModal] = useState(false);
  const [newOp, setNewOp] = useState({
    corretorId: "1",
    tipo: "LOCACAO" as "LOCACAO" | "AGENCIAMENTO",
    valor: 2000,
    perfil: true,
  });

  const summary = useMemo(() => {
    return corretores.map((c) => {
      const opsC = operations.filter((op) => op.corretorId === c.id);
      const totalLocacoes = opsC.filter((op) => op.tipo === "LOCACAO").length;
      const totalCaptacoes = opsC.filter((op) => op.tipo === "AGENCIAMENTO").length;

      let bruto = 0;
      let bonusTotal = 0;

      opsC.forEach((op) => {
        const res = calculateCommission(
          op.valorAluguel,
          totalLocacoes,
          op.tipo === "AGENCIAMENTO",
          totalCaptacoes,
          op.isProfileListing
        );
        bruto += res.comissaoCorretor;
        bonusTotal += res.bonusAgencItem;
      });

      const totalBruto = bruto + bonusTotal;
      const descontoNF = c.tipo === "PJ" ? totalBruto * 0.11 : 0;

      return {
        ...c,
        totalLocacoes,
        totalCaptacoes,
        totalBruto,
        descontoNF,
        totalLiquido: totalBruto - descontoNF,
      };
    });
  }, [operations, corretores]);

  const totalBrutoGeral = summary.reduce((s, c) => s + c.totalBruto, 0);
  const totalLiquidoGeral = summary.reduce((s, c) => s + c.totalLiquido, 0);

  const handleAddOp = () => {
    const op: Operation = {
      id: Math.random().toString(36).substr(2, 9),
      corretorId: newOp.corretorId,
      tipo: newOp.tipo,
      valorAluguel: newOp.valor,
      isProfileListing: newOp.perfil,
    };
    setOperations([...operations, op]);
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Folha de Pagamento</h1>
          <p className="text-sm text-gray-500">Registre as operações do mês e o sistema calcula comissões em tempo real.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Lançar Operação
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { id: "operations" as Tab, label: "Lançamentos", icon: Zap },
          { id: "preview" as Tab, label: "Folha Consolidada", icon: User },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Operations Table */}
      {activeTab === "operations" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Corretor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Valor Aluguel (VGL)</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Agenc. Perfil?</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Comissão Calc.</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {operations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Nenhuma operação registrada. Clique em &quot;Lançar Operação&quot; para começar.
                  </td>
                </tr>
              ) : (
                operations.map((op) => {
                  const corretor = corretores.find((c) => c.id === op.corretorId);
                  const res = calculateCommission(op.valorAluguel, 1, op.tipo === "AGENCIAMENTO", 1, op.isProfileListing);

                  return (
                    <tr key={op.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{corretor?.nome}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          op.tipo === "LOCACAO" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        )}>
                          {op.tipo === "LOCACAO" ? "Locação" : "Agenciamento"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(op.valorAluguel)}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{op.isProfileListing ? "Sim" : "Não"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(res.comissaoCorretor + res.bonusAgencItem)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setOperations(operations.filter((o) => o.id !== op.id))}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Consolidated View */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Bruto total corretores</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalBrutoGeral)}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 text-white">
              <p className="text-xs text-gray-400 mb-1">Líquido total da folha</p>
              <p className="text-2xl font-bold">{formatCurrency(totalLiquidoGeral)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Profissional</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Produção</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total Bruto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Dedução (PJ)</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.nome}</p>
                      <p className="text-xs text-gray-400">{c.tipo}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Loc.</p>
                          <p className="text-sm font-semibold text-blue-700">{c.totalLocacoes}</p>
                        </div>
                        <div className="w-px h-4 bg-gray-200" />
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Age.</p>
                          <p className="text-sm font-semibold text-purple-700">{c.totalCaptacoes}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(c.totalBruto)}</td>
                    <td className="px-4 py-3 text-right text-red-500">-{formatCurrency(c.descontoNF)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(c.totalLiquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Lançar Operação</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Corretor</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newOp.corretorId}
                  onChange={(e) => setNewOp({ ...newOp, corretorId: e.target.value })}
                >
                  {corretores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Operação</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setNewOp({ ...newOp, tipo: "LOCACAO" })}
                    className={cn(
                      "py-2 rounded-lg border text-sm font-medium transition-colors",
                      newOp.tipo === "LOCACAO" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300"
                    )}
                  >Locação</button>
                  <button
                    onClick={() => setNewOp({ ...newOp, tipo: "AGENCIAMENTO" })}
                    className={cn(
                      "py-2 rounded-lg border text-sm font-medium transition-colors",
                      newOp.tipo === "AGENCIAMENTO" ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-300"
                    )}
                  >Agenciamento</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Aluguel (VGL)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newOp.valor}
                  onChange={(e) => setNewOp({ ...newOp, valor: Number(e.target.value) })}
                />
              </div>

              {newOp.tipo === "AGENCIAMENTO" && (
                <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={newOp.perfil}
                    onChange={(e) => setNewOp({ ...newOp, perfil: e.target.checked })}
                  />
                  <span className="text-sm text-gray-700">Dentro do perfil (Bônus R$ 50)</span>
                </label>
              )}

              <button
                onClick={handleAddOp}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Registrar na Folha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
