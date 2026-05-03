"use client";

import { useEffect, useState } from "react";
import { Settings2, Save, History, AlertCircle, Building2, ShieldCheck } from "lucide-react";
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

interface NfseConfig {
  provider: string;
  companyIdConfigured: boolean;
  companyCnpjConfigured: boolean;
  municipalRegistrationConfigured: boolean;
  cityCode: string;
  serviceCode: string;
  serviceCodeComplement: string;
  defaultAliquota: string;
  homologacao: boolean;
}

interface NfseCompanyDraft {
  legalName: string;
  tradeName: string;
  cnpj: string;
  municipalRegistration: string;
  cityCode: string;
  serviceCode: string;
  serviceCodeComplement: string;
  defaultAliquota: string;
  environment: "homologacao" | "producao";
}

const NFSE_COMPANY_DRAFT_KEY = "gestao-imob:nfse-company-draft:v1";

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
    title: "Fiscal e automações",
    description: "Parâmetros fiscais e limites para aprovação automática",
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
        label: "Score mínimo para aprovação automática",
        unit: "%",
        hint: "Classificações automáticas com confiança ≥ este valor podem ser aprovadas sem revisão",
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
  const [nfseConfig, setNfseConfig] = useState<NfseConfig | null>(null);
  const [nfseConfigError, setNfseConfigError] = useState<string | null>(null);
  const [nfseDraft, setNfseDraft] = useState<NfseCompanyDraft>({
    legalName: "Imobiliaria Jardim do Lago",
    tradeName: "Jardim do Lago",
    cnpj: "",
    municipalRegistration: "",
    cityCode: "",
    serviceCode: "",
    serviceCodeComplement: "",
    defaultAliquota: "2",
    environment: "homologacao",
  });
  const [nfseDraftSaved, setNfseDraftSaved] = useState(false);

  useEffect(() => {
    const v = getParametrosVigentes();
    setVigente(v);
    setForm(v);
    setHistorico(getParametrosHistorico());
    fetch("/api/system/nfse-config", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Falha ao carregar configuracao fiscal.");
        setNfseConfig(data);
        setNfseDraft((prev) => ({
          ...prev,
          cityCode: data.cityCode || prev.cityCode,
          serviceCode: data.serviceCode || prev.serviceCode,
          serviceCodeComplement: data.serviceCodeComplement || prev.serviceCodeComplement,
          defaultAliquota: data.defaultAliquota || prev.defaultAliquota,
          environment: data.homologacao ? "homologacao" : "producao",
        }));
      })
      .catch((error) => {
        setNfseConfigError(error instanceof Error ? error.message : "Falha ao carregar configuracao fiscal.");
      });

    const rawDraft = window.localStorage.getItem(NFSE_COMPANY_DRAFT_KEY);
    if (rawDraft) {
      try {
        setNfseDraft((prev) => ({ ...prev, ...JSON.parse(rawDraft) }));
      } catch {
        window.localStorage.removeItem(NFSE_COMPANY_DRAFT_KEY);
      }
    }
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

  const saveNfseDraft = () => {
    window.localStorage.setItem(NFSE_COMPANY_DRAFT_KEY, JSON.stringify(nfseDraft));
    setNfseDraftSaved(true);
    setTimeout(() => setNfseDraftSaved(false), 2000);
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

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <Building2 className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Empresa emissora de NFS-e</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Dados fiscais editaveis pelo Admin Master. Enquanto nao houver banco, ficam salvos como rascunho local.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            Editavel local
          </span>
        </div>

        {nfseConfigError && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {nfseConfigError}
          </div>
        )}

        {nfseConfig && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Gateway", nfseConfig.provider],
              ["Modo", nfseConfig.homologacao ? "Homologacao" : "Local/Producao"],
              ["Company ID", nfseConfig.companyIdConfigured ? "Configurado" : "Pendente"],
              ["CNPJ emissor", nfseConfig.companyCnpjConfigured ? "Configurado" : "Pendente"],
              ["Inscricao municipal", nfseConfig.municipalRegistrationConfigured ? "Configurada" : "Pendente"],
              ["Cidade IBGE", nfseConfig.cityCode],
              ["Codigo servico", nfseConfig.serviceCode],
              ["Codigo complementar", nfseConfig.serviceCodeComplement],
              ["Aliquota padrao", `${nfseConfig.defaultAliquota}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-semibold">{label}</p>
                <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Rascunho da empresa emissora</h4>
              <p className="text-xs text-gray-500">
                Estes campos preparam a estrutura para PRD. A emissao real ainda usa as variaveis NFSE_* ate termos banco.
              </p>
            </div>
            <button
              onClick={saveNfseDraft}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Save className="h-3.5 w-3.5" />
              {nfseDraftSaved ? "Salvo" : "Salvar rascunho"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { key: "legalName", label: "Razao social" },
              { key: "tradeName", label: "Nome fantasia" },
              { key: "cnpj", label: "CNPJ emissor" },
              { key: "municipalRegistration", label: "Inscricao municipal" },
              { key: "cityCode", label: "Cidade IBGE" },
              { key: "serviceCode", label: "Codigo de servico" },
              { key: "serviceCodeComplement", label: "Codigo complementar" },
              { key: "defaultAliquota", label: "Aliquota padrao (%)" },
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">{field.label}</span>
                <input
                  value={String(nfseDraft[field.key as keyof NfseCompanyDraft] ?? "")}
                  onChange={(event) =>
                    setNfseDraft((prev) => ({ ...prev, [field.key]: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            ))}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Ambiente fiscal</span>
              <select
                value={nfseDraft.environment}
                onChange={(event) =>
                  setNfseDraft((prev) => ({ ...prev, environment: event.target.value as NfseCompanyDraft["environment"] }))
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="homologacao">Homologacao</option>
                <option value="producao">Producao</option>
              </select>
            </label>
          </div>
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
