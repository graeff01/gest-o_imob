"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Users, Building, UserCheck } from "lucide-react";
import { cn, formatCPF, formatCNPJ } from "@/lib/utils";
import { EmployeeForm } from "./employee-form";
import { OwnerForm } from "./owner-form";
import { ClientForm } from "./client-form";

type Tab = "funcionarios" | "proprietarios" | "clientes";

interface Employee {
  id: string;
  cpf: string;
  position: string;
  department: string;
  contract_type: string;
  is_active: boolean;
  user: { name: string; email: string };
}

interface Owner {
  id: string;
  name: string;
  cpf_cnpj: string;
  person_type: string;
  phone: string | null;
  email: string | null;
}

interface Client {
  id: string;
  name: string;
  cpf_cnpj: string;
  person_type: string;
  phone: string | null;
  email: string | null;
}

const tabs = [
  { key: "funcionarios" as Tab, label: "Funcionarios", icon: Users },
  { key: "proprietarios" as Tab, label: "Proprietarios", icon: Building },
  { key: "clientes" as Tab, label: "Clientes", icon: UserCheck },
];

const positionLabels: Record<string, string> = {
  CONSULTOR: "Consultor",
  CAPTADOR: "Captador",
  GERENTE: "Gerente",
  RECEPCAO: "Recepcao",
  ESTAGIARIO: "Estagiario",
  MANUTENCAO: "Manutencao",
  MKT: "Marketing",
};

export default function PessoasPage() {
  const [activeTab, setActiveTab] = useState<Tab>("funcionarios");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);

    if (activeTab === "funcionarios") {
      const res = await fetch(`/api/employees?${params}`);
      const data = await res.json();
      setEmployees(data.employees || []);
    } else if (activeTab === "proprietarios") {
      const res = await fetch(`/api/property-owners?${params}`);
      const data = await res.json();
      setOwners(data.owners || []);
    } else {
      const res = await fetch(`/api/clients?${params}`);
      const data = await res.json();
      setClients(data.clients || []);
    }
    setLoading(false);
  }, [activeTab, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleCreated() {
    setShowForm(false);
    fetchData();
  }

  function formatDoc(doc: string, type: string) {
    if (type === "PJ" || doc.length === 14) return formatCNPJ(doc);
    return formatCPF(doc);
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setShowForm(false); setSearch(""); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou CPF/CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-6">
          {activeTab === "funcionarios" && (
            <EmployeeForm onSuccess={handleCreated} onCancel={() => setShowForm(false)} />
          )}
          {activeTab === "proprietarios" && (
            <OwnerForm onSuccess={handleCreated} onCancel={() => setShowForm(false)} />
          )}
          {activeTab === "clientes" && (
            <ClientForm onSuccess={handleCreated} onCancel={() => setShowForm(false)} />
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === "funcionarios" && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">CPF</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cargo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Depto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum funcionario cadastrado</td></tr>
                  ) : employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{emp.user.name}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.user.email}</td>
                      <td className="px-4 py-3 text-gray-600">{formatCPF(emp.cpf)}</td>
                      <td className="px-4 py-3 text-gray-600">{positionLabels[emp.position] || emp.position}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          emp.contract_type === "CLT" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        )}>
                          {emp.contract_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "proprietarios" && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">CPF/CNPJ</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Telefone</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {owners.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhum proprietario cadastrado</td></tr>
                  ) : owners.map((owner) => (
                    <tr key={owner.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{owner.name}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDoc(owner.cpf_cnpj, owner.person_type)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          owner.person_type === "PF" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        )}>
                          {owner.person_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{owner.phone || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{owner.email || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "clientes" && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">CPF/CNPJ</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Telefone</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhum cliente cadastrado</td></tr>
                  ) : clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{client.name}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDoc(client.cpf_cnpj, client.person_type)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          client.person_type === "PF" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        )}>
                          {client.person_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{client.phone || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{client.email || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
