"use client";

import { useState } from "react";
import {
  FileText,
  Plus,
  Search,
  Send,
  CheckCircle2,
  Clock,
  X,
  Ban,
  DollarSign,
  Eye,
  Printer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Tab = "todas" | "pendentes" | "nova";
type InvoiceStatus = "PENDENTE" | "EMITIDA" | "ENVIADA" | "PAGA" | "CANCELADA";
type ServiceType = "INTERMEDIACAO" | "AGENCIAMENTO" | "ADMINISTRACAO";

interface MockInvoice {
  id: string;
  nfseNumber?: number;
  yearSequence: number;
  referenceYear: number;
  clientName: string;
  clientCpfCnpj: string;
  clientContact?: string;
  propertyAddress?: string;
  contractNumber?: string;
  serviceType: ServiceType;
  amount: number;
  descriptionTitle: string;
  descriptionBody: string;
  status: InvoiceStatus;
  issuedAt?: string;
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
  notes?: string;
  corretorName?: string;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDENTE: { label: "Pendente", color: "bg-amber-50 text-amber-700", icon: Clock },
  EMITIDA: { label: "Emitida", color: "bg-blue-50 text-blue-700", icon: FileText },
  ENVIADA: { label: "Enviada", color: "bg-indigo-50 text-indigo-700", icon: Send },
  PAGA: { label: "Paga", color: "bg-green-50 text-green-700", icon: CheckCircle2 },
  CANCELADA: { label: "Cancelada", color: "bg-red-50 text-red-700", icon: Ban },
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  INTERMEDIACAO: "Intermediação",
  AGENCIAMENTO: "Agenciamento",
  ADMINISTRACAO: "Administração",
};

const MOCK_INVOICES: MockInvoice[] = [
  {
    id: "1", yearSequence: 1, referenceYear: 2026, clientName: "João Carlos Mendes", clientCpfCnpj: "123.456.789-00",
    propertyAddress: "Av. Independência, 1200, Ap 301", contractNumber: "MV-2026-0001",
    serviceType: "INTERMEDIACAO", amount: 2500, descriptionTitle: "Intermediação de Locação",
    descriptionBody: "Serviço de intermediação de locação residencial referente ao contrato MV-2026-0001.",
    status: "PAGA", issuedAt: "2026-03-05", sentAt: "2026-03-05", paidAt: "2026-03-10",
    createdAt: "2026-03-01", corretorName: "Lucas Rodrigues",
  },
  {
    id: "2", yearSequence: 2, referenceYear: 2026, clientName: "Empresa XYZ Ltda", clientCpfCnpj: "12.345.678/0001-90",
    propertyAddress: "Rua Padre Chagas, 302, Sala 5", contractNumber: "MV-2026-0002",
    serviceType: "ADMINISTRACAO", amount: 750, descriptionTitle: "Administração de Locação",
    descriptionBody: "Taxa de administração mensal referente ao contrato MV-2026-0002 - mês 03/2026.",
    status: "ENVIADA", issuedAt: "2026-03-28", sentAt: "2026-03-28",
    createdAt: "2026-03-25",
  },
  {
    id: "3", yearSequence: 3, referenceYear: 2026, clientName: "Ana Paula Ferreira", clientCpfCnpj: "555.666.777-88",
    propertyAddress: "R. Mostardeiro, 555, Ap 12", contractNumber: "MV-2026-0003",
    serviceType: "INTERMEDIACAO", amount: 1800, descriptionTitle: "Intermediação de Locação",
    descriptionBody: "Serviço de intermediação de locação residencial.",
    status: "EMITIDA", issuedAt: "2026-04-01",
    createdAt: "2026-04-01", corretorName: "Fernanda Oliveira",
  },
  {
    id: "4", yearSequence: 4, referenceYear: 2026, clientName: "Roberto Almeida Costa", clientCpfCnpj: "444.333.222-11",
    serviceType: "AGENCIAMENTO", amount: 3200, descriptionTitle: "Agenciamento de Imóvel",
    descriptionBody: "Serviço de agenciamento e captação de imóvel para locação.",
    status: "PENDENTE", createdAt: "2026-04-03", corretorName: "Rafael Souza",
  },
  {
    id: "5", yearSequence: 5, referenceYear: 2026, clientName: "Lucia Hoffmann", clientCpfCnpj: "212.121.212-12",
    propertyAddress: "Av. Goethe, 77, Cobertura",
    serviceType: "INTERMEDIACAO", amount: 8500, descriptionTitle: "Intermediação de Locação Premium",
    descriptionBody: "Serviço de intermediação de locação de imóvel premium - cobertura.",
    status: "PENDENTE", createdAt: "2026-04-04", corretorName: "Lucas Rodrigues",
  },
];

export default function NotasFiscaisPage() {
  const [activeTab, setActiveTab] = useState<Tab>("todas");
  const [invoices, setInvoices] = useState<MockInvoice[]>(MOCK_INVOICES);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterService, setFilterService] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [form, setForm] = useState({
    clientName: "",
    clientCpfCnpj: "",
    clientContact: "",
    propertyAddress: "",
    serviceType: "INTERMEDIACAO" as ServiceType,
    amount: "",
    descriptionTitle: "",
    descriptionBody: "",
    notes: "",
    corretorName: "",
  });

  const filtered = invoices.filter((inv) => {
    if (search && !inv.clientName.toLowerCase().includes(search.toLowerCase()) &&
        !inv.clientCpfCnpj.includes(search) &&
        !(inv.contractNumber || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && inv.status !== filterStatus) return false;
    if (filterService && inv.serviceType !== filterService) return false;
    if (activeTab === "pendentes" && inv.status !== "PENDENTE") return false;
    return true;
  });

  const totalPendente = invoices.filter((i) => i.status === "PENDENTE").reduce((s, i) => s + i.amount, 0);
  const totalEmitido = invoices.filter((i) => ["EMITIDA", "ENVIADA"].includes(i.status)).reduce((s, i) => s + i.amount, 0);
  const totalPago = invoices.filter((i) => i.status === "PAGA").reduce((s, i) => s + i.amount, 0);

  const updateStatus = (id: string, newStatus: InvoiceStatus) => {
    const now = new Date().toISOString().split("T")[0];
    setInvoices(invoices.map((inv) => {
      if (inv.id !== id) return inv;
      const updates: Partial<MockInvoice> = { status: newStatus };
      if (newStatus === "EMITIDA") updates.issuedAt = now;
      if (newStatus === "ENVIADA") updates.sentAt = now;
      if (newStatus === "PAGA") updates.paidAt = now;
      return { ...inv, ...updates };
    }));
  };

  const handleSubmit = () => {
    if (!form.clientName || !form.clientCpfCnpj || !form.amount || !form.descriptionTitle || !form.descriptionBody) return;

    const newInvoice: MockInvoice = {
      id: Math.random().toString(36).substr(2, 9),
      yearSequence: invoices.length + 1,
      referenceYear: 2026,
      clientName: form.clientName,
      clientCpfCnpj: form.clientCpfCnpj,
      clientContact: form.clientContact || undefined,
      propertyAddress: form.propertyAddress || undefined,
      serviceType: form.serviceType,
      amount: parseFloat(form.amount),
      descriptionTitle: form.descriptionTitle,
      descriptionBody: form.descriptionBody,
      status: "PENDENTE",
      createdAt: new Date().toISOString().split("T")[0],
      notes: form.notes || undefined,
      corretorName: form.corretorName || undefined,
    };

    setInvoices([newInvoice, ...invoices]);
    setForm({ clientName: "", clientCpfCnpj: "", clientContact: "", propertyAddress: "", serviceType: "INTERMEDIACAO", amount: "", descriptionTitle: "", descriptionBody: "", notes: "", corretorName: "" });
    setShowForm(false);
    setActiveTab("todas");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notas Fiscais</h1>
          <p className="text-sm text-gray-500">Controle de NFs emitidas, enviadas e pagas.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setActiveTab("nova"); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova NF
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Total de NFs</p>
          <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <Clock className="h-3 w-3 text-amber-500" /> A emitir
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPendente)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <Send className="h-3 w-3 text-blue-500" /> Em trânsito
          </div>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalEmitido)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" /> Recebido
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPago)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { id: "todas" as Tab, label: "Todas" },
          { id: "pendentes" as Tab, label: `Pendentes (${invoices.filter((i) => i.status === "PENDENTE").length})` },
          { id: "nova" as Tab, label: "Nova NF" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === "nova") setShowForm(true); }}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Form */}
      {activeTab === "nova" && showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Criar Nota Fiscal</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente *</label>
              <input type="text" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ *</label>
              <input type="text" value={form.clientCpfCnpj} onChange={(e) => setForm({ ...form, clientCpfCnpj: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contato</label>
              <input type="text" value={form.clientContact} onChange={(e) => setForm({ ...form, clientContact: e.target.value })}
                placeholder="Telefone ou email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Serviço *</label>
              <select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value as ServiceType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="INTERMEDIACAO">Intermediação</option>
                <option value="AGENCIAMENTO">Agenciamento</option>
                <option value="ADMINISTRACAO">Administração</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Corretor vinculado</label>
              <input type="text" value={form.corretorName} onChange={(e) => setForm({ ...form, corretorName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereço do Imóvel</label>
              <input type="text" value={form.propertyAddress} onChange={(e) => setForm({ ...form, propertyAddress: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título da NF *</label>
              <input type="text" value={form.descriptionTitle} onChange={(e) => setForm({ ...form, descriptionTitle: e.target.value })}
                placeholder="Ex: Intermediação de Locação Residencial"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição dos Serviços *</label>
              <textarea rows={3} value={form.descriptionBody} onChange={(e) => setForm({ ...form, descriptionBody: e.target.value })}
                placeholder="Descreva os serviços prestados..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações internas</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => { setShowForm(false); setActiveTab("todas"); }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Criar Nota Fiscal
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {(activeTab === "todas" || activeTab === "pendentes") && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Buscar por cliente, CPF/CNPJ ou contrato..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {activeTab === "todas" && (
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Todos os status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            )}
            <select value={filterService} onChange={(e) => setFilterService(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">Todos os serviços</option>
              {Object.entries(SERVICE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Serviço</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Corretor</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Ações</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      Nenhuma nota fiscal encontrada.
                    </td></tr>
                  ) : filtered.map((inv) => {
                    const st = STATUS_CONFIG[inv.status];
                    const StatusIcon = st.icon;
                    const isExpanded = expandedId === inv.id;

                    return (
                      <tr key={inv.id} className="group">
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            NF-{inv.referenceYear}-{String(inv.yearSequence).padStart(3, "0")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{inv.clientName}</p>
                          <p className="text-xs text-gray-400">{inv.clientCpfCnpj}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {SERVICE_LABELS[inv.serviceType]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{inv.corretorName || "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(inv.amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", st.color)}>
                            <StatusIcon className="h-3 w-3" /> {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {inv.status === "PENDENTE" && (
                              <button onClick={() => updateStatus(inv.id, "EMITIDA")}
                                className="p-1.5 border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" title="Emitir">
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {inv.status === "EMITIDA" && (
                              <button onClick={() => updateStatus(inv.id, "ENVIADA")}
                                className="p-1.5 border border-indigo-200 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors" title="Marcar como enviada">
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {(inv.status === "EMITIDA" || inv.status === "ENVIADA") && (
                              <button onClick={() => updateStatus(inv.id, "PAGA")}
                                className="p-1.5 border border-green-200 rounded-lg text-green-600 hover:bg-green-50 transition-colors" title="Marcar como paga">
                                <DollarSign className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {inv.status !== "CANCELADA" && inv.status !== "PAGA" && (
                              <button onClick={() => updateStatus(inv.id, "CANCELADA")}
                                className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Cancelar">
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                            className="text-gray-400 hover:text-gray-600">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Expanded detail rows */}
                  {filtered.map((inv) => expandedId === inv.id && (
                    <tr key={`${inv.id}-detail`} className="bg-gray-50">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-4 gap-4 text-xs">
                          <div><p className="text-gray-400 mb-0.5">Título</p><p className="font-medium text-gray-700">{inv.descriptionTitle}</p></div>
                          <div><p className="text-gray-400 mb-0.5">Imóvel</p><p className="font-medium text-gray-700">{inv.propertyAddress || "—"}</p></div>
                          <div><p className="text-gray-400 mb-0.5">Contrato</p><p className="font-medium text-gray-700">{inv.contractNumber || "—"}</p></div>
                          <div><p className="text-gray-400 mb-0.5">Criada em</p><p className="font-medium text-gray-700">{formatDate(inv.createdAt)}</p></div>
                        </div>
                        <div className="mt-3 text-xs">
                          <p className="text-gray-400 mb-0.5">Descrição dos serviços</p>
                          <p className="text-gray-600">{inv.descriptionBody}</p>
                        </div>
                        {inv.notes && (
                          <div className="mt-2 text-xs">
                            <p className="text-gray-400 mb-0.5">Observações</p>
                            <p className="text-gray-600">{inv.notes}</p>
                          </div>
                        )}
                        <div className="mt-3 flex gap-4 text-xs">
                          {inv.issuedAt && <p className="text-gray-400">Emitida: <span className="text-gray-700">{formatDate(inv.issuedAt)}</span></p>}
                          {inv.sentAt && <p className="text-gray-400">Enviada: <span className="text-gray-700">{formatDate(inv.sentAt)}</span></p>}
                          {inv.paidAt && <p className="text-gray-400">Paga: <span className="text-green-700 font-medium">{formatDate(inv.paidAt)}</span></p>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
