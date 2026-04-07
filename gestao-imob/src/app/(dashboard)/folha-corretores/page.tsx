"use client";

/**
 * FOLHA DE PAGAMENTO — ESQUELETO
 *
 * Estrutura preparada para receber:
 * 1. Regras reais de comissão (a definir com base na planilha do usuário)
 * 2. Importação automática via IA de planilha de resultados mensais
 *
 * A função `calculatePayroll` está isolada — quando as regras forem definidas,
 * basta preencher o corpo dela sem alterar a UI.
 */

import { useEffect, useState } from "react";
import {
  Wallet,
  Plus,
  User,
  X,
  Upload,
  Sparkles,
  Settings2,
  Users,
  FileSpreadsheet,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// ─── Tipos ─────────────────────────────────────────

type Role = "CAPTADOR" | "CONSULTOR" | "ADMIN";
type ContractType = "CLT" | "PJ";

interface Employee {
  id: string;
  nome: string;
  cpf: string;
  cargo: Role;
  tipoContrato: ContractType;
  salarioFixo: number;
  valeRefeicao: number;
  valeTransporte: number;
  pix: string;
  /** Regra de comissão vinculada — placeholder. Será preenchido após definição. */
  regraComissaoId?: string;
  ativo: boolean;
}

/**
 * Regra de comissão genérica — estrutura aberta para acomodar
 * diferentes modelos (por tier, por unidade, percentual fixo, híbrido).
 * Os campos concretos serão definidos quando a planilha for compartilhada.
 */
interface CommissionRule {
  id: string;
  nome: string;
  cargo: Role;
  /** Descrição livre da regra — "10% até 3 locações, 11% de 4-9, 13% a partir de 10" */
  descricao: string;
  /** JSON livre para parâmetros (tiers, percentuais, bônus) — preenchido depois */
  parametros: Record<string, unknown>;
}

/**
 * Resultado mensal de um funcionário — o que a IA vai extrair da planilha.
 * Campos são genéricos de propósito; serão mapeados para colunas reais depois.
 */
interface MonthlyResult {
  id: string;
  employeeId: string;
  mes: string; // "2026-04"
  /** Quantidade principal (locações fechadas, imóveis captados, vendas) */
  quantidade: number;
  /** Valor base sobre o qual a comissão incide */
  valorBase: number;
  /** Campos adicionais extraídos pela IA (chave → valor) */
  extras: Record<string, number>;
  origem: "MANUAL" | "IA";
}

interface PayrollLine {
  employee: Employee;
  salarioFixo: number;
  beneficios: number;
  comissao: number;
  descontos: number;
  total: number;
  origem: "MANUAL" | "IA" | "PENDENTE";
}

// ─── Persistência local (placeholder até ter banco) ────

const STORAGE = {
  employees: "folha-employees-v1",
  rules: "folha-rules-v1",
  results: "folha-results-v1",
};

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// ─── Motor de cálculo — ESQUELETO ─────────────────

/**
 * TODO: preencher quando a planilha de comissões for compartilhada.
 *
 * Entradas:
 *  - employee: funcionário com salário fixo e regra vinculada
 *  - result:   resultado mensal (quantidade, valor base, extras)
 *  - rule:     regra de comissão aplicável
 *
 * Saída: PayrollLine com salário fixo + comissão calculada.
 */
function calculatePayroll(
  employee: Employee,
  result: MonthlyResult | undefined,
  rule: CommissionRule | undefined
): PayrollLine {
  const beneficios = employee.valeRefeicao + employee.valeTransporte;

  // Placeholder: sem regra definida, comissão = 0.
  // Quando as regras forem implementadas, a lógica real vai aqui.
  const comissao = 0;
  void result;
  void rule;

  const descontos = 0;
  const total = employee.salarioFixo + beneficios + comissao - descontos;

  return {
    employee,
    salarioFixo: employee.salarioFixo,
    beneficios,
    comissao,
    descontos,
    total,
    origem: result ? result.origem : "PENDENTE",
  };
}

// ─── Seed inicial (vazio) ──────────────────────────

const EMPTY_EMPLOYEE: Omit<Employee, "id"> = {
  nome: "",
  cpf: "",
  cargo: "CONSULTOR",
  tipoContrato: "CLT",
  salarioFixo: 0,
  valeRefeicao: 0,
  valeTransporte: 0,
  pix: "",
  ativo: true,
};

// ─── Página ────────────────────────────────────────

type Tab = "funcionarios" | "regras" | "folha";

export default function FolhaPage() {
  const [tab, setTab] = useState<Tab>("funcionarios");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [results, setResults] = useState<MonthlyResult[]>([]);
  const [mounted, setMounted] = useState(false);

  // Modal de edição
  const [editing, setEditing] = useState<Employee | null>(null);
  const [showImport, setShowImport] = useState(false);

  const now = new Date();
  const [mesRef, setMesRef] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );

  useEffect(() => {
    setMounted(true);
    setEmployees(loadJSON(STORAGE.employees, []));
    setRules(loadJSON(STORAGE.rules, []));
    setResults(loadJSON(STORAGE.results, []));
  }, []);

  useEffect(() => {
    if (mounted) saveJSON(STORAGE.employees, employees);
  }, [employees, mounted]);
  useEffect(() => {
    if (mounted) saveJSON(STORAGE.rules, rules);
  }, [rules, mounted]);
  useEffect(() => {
    if (mounted) saveJSON(STORAGE.results, results);
  }, [results, mounted]);

  // ─── Funcionários ────────────────────────────────

  const openNew = () =>
    setEditing({ id: "", ...EMPTY_EMPLOYEE });

  const saveEmployee = (emp: Employee) => {
    if (!emp.nome.trim()) return;
    if (emp.id) {
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
    } else {
      setEmployees((prev) => [...prev, { ...emp, id: crypto.randomUUID() }]);
    }
    setEditing(null);
  };

  const deleteEmployee = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  // ─── Folha consolidada ───────────────────────────

  const folhaLines: PayrollLine[] = employees
    .filter((e) => e.ativo)
    .map((e) => {
      const result = results.find(
        (r) => r.employeeId === e.id && r.mes === mesRef
      );
      const rule = rules.find((r) => r.id === e.regraComissaoId);
      return calculatePayroll(e, result, rule);
    });

  const totalFolha = folhaLines.reduce((sum, l) => sum + l.total, 0);

  // ─── Render ──────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Folha de Pagamento</h1>
          <p className="text-sm text-gray-500">
            Funcionários CLT/PJ com salário fixo + comissão variável
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-md hover:shadow-blue-600/25 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Importar planilha (IA)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: "funcionarios" as Tab, label: "Funcionários", icon: Users },
          { id: "regras" as Tab, label: "Regras de Comissão", icon: Settings2 },
          { id: "folha" as Tab, label: "Folha Mensal", icon: Wallet },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: Funcionários ─────────────────── */}
      {tab === "funcionarios" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {employees.length} funcionário(s) cadastrado(s)
            </p>
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" /> Novo funcionário
            </button>
          </div>

          {employees.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
              <User className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Nenhum funcionário cadastrado ainda.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Comece adicionando captadores, consultores e equipe administrativa.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Nome</th>
                    <th className="px-4 py-3 text-left">Cargo</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-right">Salário Fixo</th>
                    <th className="px-4 py-3 text-right">Benefícios</th>
                    <th className="px-4 py-3 text-center">Regra</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((e) => {
                    const rule = rules.find((r) => r.id === e.regraComissaoId);
                    return (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{e.nome}</p>
                          <p className="text-[11px] text-gray-400">{e.cpf}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            {e.cargo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {e.tipoContrato}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatCurrency(e.salarioFixo)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {formatCurrency(e.valeRefeicao + e.valeTransporte)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {rule ? (
                            <span className="text-[11px] text-blue-600">
                              {rule.nome}
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-400">
                              não definida
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setEditing(e)}
                              className="p-1.5 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-600"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => deleteEmployee(e.id)}
                              className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: Regras ─────────────────────── */}
      {tab === "regras" && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Settings2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">
            Regras de comissão — aguardando definição
          </p>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            A estrutura está pronta para receber as regras reais (tiers, percentuais,
            bônus por unidade). Compartilhe a planilha de comissões e esta tela será
            preenchida com os modelos específicos para captador, consultor e demais
            funções.
          </p>
          <div className="mt-4 inline-block text-left bg-gray-50 border border-gray-200 rounded-lg p-3 text-[11px] text-gray-500 font-mono">
            CommissionRule {"{"}
            <br />
            &nbsp;&nbsp;id, nome, cargo, descricao,
            <br />
            &nbsp;&nbsp;parametros: {"{ ... a definir ... }"}
            <br />
            {"}"}
          </div>
        </div>
      )}

      {/* ─── TAB: Folha Mensal ───────────────── */}
      {tab === "folha" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs text-gray-500">Mês de referência</label>
              <input
                type="month"
                value={mesRef}
                onChange={(e) => setMesRef(e.target.value)}
                className="ml-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total da folha</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(totalFolha)}
              </p>
            </div>
          </div>

          {folhaLines.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
              <Wallet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Cadastre funcionários para ver a folha mensal consolidada.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Funcionário</th>
                    <th className="px-4 py-3 text-right">Fixo</th>
                    <th className="px-4 py-3 text-right">Benefícios</th>
                    <th className="px-4 py-3 text-right">Comissão</th>
                    <th className="px-4 py-3 text-right">Descontos</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {folhaLines.map((l) => (
                    <tr key={l.employee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {l.employee.nome}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {l.employee.cargo} · {l.employee.tipoContrato}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(l.salarioFixo)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatCurrency(l.beneficios)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatCurrency(l.comissao)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatCurrency(l.descontos)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {formatCurrency(l.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                            l.origem === "IA"
                              ? "bg-blue-50 text-blue-600"
                              : l.origem === "MANUAL"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-amber-50 text-amber-600"
                          )}
                        >
                          {l.origem}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Modal Funcionário ───────────────── */}
      {editing && (
        <EmployeeModal
          employee={editing}
          rules={rules}
          onSave={saveEmployee}
          onClose={() => setEditing(null)}
        />
      )}

      {/* ─── Modal Importação IA ─────────────── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Importar planilha de resultados
                  </h3>
                  <p className="text-xs text-gray-500">Processamento via IA</p>
                </div>
              </div>
              <button
                onClick={() => setShowImport(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                Arraste a planilha aqui ou clique para selecionar
              </p>
            </div>

            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-[11px] text-amber-700">
                <strong>Estrutura pronta</strong> — aguardando definição das regras
                de comissão e do formato da planilha. Após compartilhar o modelo, a
                IA irá extrair quantidade de locações/captações, valor base e calcular
                o total da folha automaticamente.
              </p>
            </div>

            <button
              onClick={() => setShowImport(false)}
              className="w-full mt-4 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal de Funcionário ─────────────────────────

function EmployeeModal({
  employee,
  rules,
  onSave,
  onClose,
}: {
  employee: Employee;
  rules: CommissionRule[];
  onSave: (e: Employee) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Employee>(employee);

  const update = <K extends keyof Employee>(key: K, value: Employee[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-900">
            {employee.id ? "Editar funcionário" : "Novo funcionário"}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nome completo</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => update("nome", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">CPF</label>
              <input
                type="text"
                value={form.cpf}
                onChange={(e) => update("cpf", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">PIX</label>
              <input
                type="text"
                value={form.pix}
                onChange={(e) => update("pix", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cargo</label>
              <select
                value={form.cargo}
                onChange={(e) => update("cargo", e.target.value as Role)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="CAPTADOR">Captador</option>
                <option value="CONSULTOR">Consultor</option>
                <option value="ADMIN">Administrativo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo de contrato</label>
              <select
                value={form.tipoContrato}
                onChange={(e) =>
                  update("tipoContrato", e.target.value as ContractType)
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="CLT">CLT</option>
                <option value="PJ">PJ</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Salário fixo</label>
            <input
              type="number"
              value={form.salarioFixo}
              onChange={(e) => update("salarioFixo", Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Vale refeição
              </label>
              <input
                type="number"
                value={form.valeRefeicao}
                onChange={(e) => update("valeRefeicao", Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Vale transporte
              </label>
              <input
                type="number"
                value={form.valeTransporte}
                onChange={(e) => update("valeTransporte", Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Regra de comissão
            </label>
            <select
              value={form.regraComissaoId || ""}
              onChange={(e) =>
                update("regraComissaoId", e.target.value || undefined)
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">— sem regra (a definir) —</option>
              {rules
                .filter((r) => r.cargo === form.cargo)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              Regras serão cadastradas após definição do modelo de comissão.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => update("ativo", e.target.checked)}
            />
            Funcionário ativo
          </label>
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
