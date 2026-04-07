"use client";

import { useEffect, useState } from "react";
import { Settings2, Save, History, AlertCircle } from "lucide-react";
import { PageShell } from "@/components/shared/page-shell";
import { cn } from "@/lib/utils";
import {
  ParametrosSistema,
  getParametrosVigentes,
  getParametrosHistorico,
  saveParametros,
} from "@/lib/stores/core-store";

interface FieldDef {
  key: keyof ParametrosSistema;
  label: string;
  unit?: string;
  type?: "number" | "select";
  options?: string[];
  hint?: string;
}

interface SectionDef {
  title: string;
  description: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    title: "Financeiro",
    description: "Taxas e percentuais aplicados sobre receitas e repasses",
    fields: [
      { key: "taxaAdministracao", label: "Taxa de administração padrão", unit: "%" },
      { key: "taxaAdministracaoReal", label: "Taxa real (efetiva)", unit: "%" },
      { key: "percentualRepasseMatriz", label: "Repasse à matriz", unit: "%", hint: "% do faturamento bruto" },
      { key: "percentualReceitaAgencia", label: "Receita da agência", unit: "%" },
    ],
  },
  {
    title: "Comissões — Consultor",
    description: "Tiers de comissão por número de locações fechadas no mês",
    fields: [
      { key: "consultorTier1Max", label: "Tier 1: até N locações", unit: "loc" },
      { key: "consultorTier1Percent", label: "Tier 1: percentual", unit: "%" },
      { key: "consultorTier2Max", label: "Tier 2: até N locações", unit: "loc" },
      { key: "consultorTier2Percent", label: "Tier 2: percentual", unit: "%" },
      { key: "consultorTier3Percent", label: "Tier 3 (acima): percentual", unit: "%" },
    ],
  },
  {
    title: "Comissões — Captador",
    description: "Tiers e bônus por imóvel captado",
    fields: [
      { key: "captadorTier1Max", label: "Tier 1: até N imóveis", unit: "imv" },
      { key: "captadorTier1Percent", label: "Tier 1: percentual", unit: "%" },
      { key: "captadorTier2Max", label: "Tier 2: até N imóveis", unit: "imv" },
      { key: "captadorTier2Percent", label: "Tier 2: percentual", unit: "%" },
      { key: "captadorTier3Percent", label: "Tier 3 (acima): percentual", unit: "%" },
      { key: "captadorBonusPorImovel", label: "Bônus por imóvel captado", unit: "R$" },
    ],
  },
  {
    title: "Vendas e Campanhas",
    description: "Comissões de venda e valores de campanhas internas",
    fields: [
      { key: "vendaPercent", label: "Comissão de venda", unit: "%" },
      { key: "campanhaSucessoValor", label: "Campanha sucesso (por contrato)", unit: "R$" },
      { key: "campanhaCaptacaoValor", label: "Campanha captação (por imóvel)", unit: "R$" },
    ],
  },
  {
    title: "Régua de Cobrança",
    description: "Dias após vencimento para disparar avisos",
    fields: [
      { key: "reguaAviso1", label: "Primeiro aviso (D+)", unit: "dias" },
      { key: "reguaAviso2", label: "Segundo aviso (D+)", unit: "dias" },
      { key: "reguaAviso3", label: "Terceiro aviso (D+)", unit: "dias" },
      { key: "reguaJuridico", label: "Encaminhar ao jurídico (D+)", unit: "dias" },
    ],
  },
  {
    title: "Fiscal e IA",
    description: "Parâmetros fiscais e thresholds da IA",
    fields: [
      { key: "prazoEmissaoNF", label: "Prazo emissão NF (dia do mês)", unit: "" },
      {
        key: "indiceReajustePadrao",
        label: "Índice de reajuste padrão",
        type: "select",
        options: ["IGPM", "IPCA"],
      },
      {
        key: "scoreConfiancaAutoAprovacao",
        label: "Score mínimo para auto-aprovação da IA",
        unit: "%",
        hint: "Sugestões da IA com confiança ≥ este valor são aprovadas automaticamente",
      },
    ],
  },
];

export default function ConfiguracoesPage() {
  const [vigente, setVigente] = useState<ParametrosSistema | null>(null);
  const [historico, setHistorico] = useState<ParametrosSistema[]>([]);
  const [form, setForm] = useState<ParametrosSistema | null>(null);
  const [motivo, setMotivo] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const v = getParametrosVigentes();
    setVigente(v);
    setForm(v);
    setHistorico(getParametrosHistorico());
  }, []);

  if (!form || !vigente) return null;

  const dirty = JSON.stringify(form) !== JSON.stringify(vigente);

  const update = <K extends keyof ParametrosSistema>(key: K, value: ParametrosSistema[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = () => {
    if (!motivo.trim()) {
      alert("Informe um motivo para a alteração (auditoria).");
      return;
    }
    const { versao: _v, vigenteDesde: _d, alteradoPor: _a, motivo: _m, ...rest } = form;
    void _v; void _d; void _a; void _m;
    const novo = saveParametros(rest, motivo);
    setVigente(novo);
    setForm(novo);
    setHistorico(getParametrosHistorico());
    setMotivo("");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  return (
    <PageShell
      title="Parâmetros do Sistema"
      description="Regras de negócio centralizadas — alterações são versionadas e auditadas"
      icon={Settings2}
      actions={
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <History className="h-3.5 w-3.5" />
          Histórico ({historico.length} versões)
        </button>
      }
    >
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700">
          <p className="font-medium mb-0.5">
            Versão vigente: <strong>v{vigente.versao}</strong> — desde{" "}
            {new Date(vigente.vigenteDesde).toLocaleString("pt-BR")}
          </p>
          <p className="text-blue-600/80">
            Toda alteração gera uma nova versão imutável e fica registrada no log de auditoria. As regras
            antigas continuam disponíveis para consulta histórica.
          </p>
        </div>
      </div>

      {showHistory && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Histórico de versões</h3>
          {historico
            .slice()
            .reverse()
            .map((h) => (
              <div
                key={h.versao}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border text-xs",
                  h.versao === vigente.versao
                    ? "bg-blue-50 border-blue-200"
                    : "bg-gray-50 border-gray-100"
                )}
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    v{h.versao} {h.versao === vigente.versao && "(vigente)"}
                  </p>
                  <p className="text-gray-500">
                    {new Date(h.vigenteDesde).toLocaleString("pt-BR")} ·{" "}
                    {h.alteradoPor || "Sistema"}
                  </p>
                  {h.motivo && <p className="text-gray-600 italic mt-0.5">"{h.motivo}"</p>}
                </div>
              </div>
            ))}
        </div>
      )}

      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.title} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
              <p className="text-xs text-gray-500">{section.description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.fields.map((field) => (
                <div key={String(field.key)}>
                  <label className="block text-xs text-gray-600 mb-1">
                    {field.label}
                    {field.unit && <span className="text-gray-400 ml-1">({field.unit})</span>}
                  </label>
                  {field.type === "select" ? (
                    <select
                      value={String(form[field.key])}
                      onChange={(e) =>
                        update(field.key, e.target.value as ParametrosSistema[typeof field.key])
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      {field.options?.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={Number(form[field.key])}
                      onChange={(e) =>
                        update(field.key, Number(e.target.value) as ParametrosSistema[typeof field.key])
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  )}
                  {field.hint && <p className="text-[10px] text-gray-400 mt-1">{field.hint}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer fixo de save */}
      <div
        className={cn(
          "sticky bottom-0 bg-white border border-gray-200 rounded-xl p-4 shadow-lg transition-all",
          dirty ? "opacity-100" : "opacity-60"
        )}
      >
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da alteração (obrigatório para auditoria)"
            disabled={!dirty}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50"
          />
          <button
            onClick={handleSave}
            disabled={!dirty || !motivo.trim()}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              savedFlash
                ? "bg-green-600 text-white"
                : dirty && motivo.trim()
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            <Save className="h-4 w-4" />
            {savedFlash ? "Salvo!" : "Salvar nova versão"}
          </button>
        </div>
        {dirty && (
          <p className="text-[11px] text-amber-600 mt-2">
            Você tem alterações não salvas. Uma nova versão será criada.
          </p>
        )}
      </div>
    </PageShell>
  );
}
