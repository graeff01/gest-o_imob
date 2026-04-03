import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  TrendingDown,
  FileText,
  Users,
} from "lucide-react";

async function getDashboardData(month: number, year: number) {
  const [revenueTotal, expenseTotal, contractCount, employeeCount] =
    await Promise.all([
      prisma.revenue.aggregate({
        where: { reference_month: month, reference_year: year },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { reference_month: month, reference_year: year },
        _sum: { amount: true },
      }),
      prisma.contract.count({
        where: { status: "ATIVO" },
      }),
      prisma.employee.count({
        where: { is_active: true },
      }),
    ]);

  return {
    revenue: Number(revenueTotal._sum.amount || 0),
    expenses: Number(expenseTotal._sum.amount || 0),
    contracts: contractCount,
    employees: employeeCount,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const now = new Date();
  const data = await getDashboardData(now.getMonth() + 1, now.getFullYear());
  const balance = data.revenue - data.expenses;

  const cards = [
    {
      title: "Receitas do Mes",
      value: formatCurrency(data.revenue),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Despesas do Mes",
      value: formatCurrency(data.expenses),
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Contratos Ativos",
      value: data.contracts.toString(),
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Funcionarios Ativos",
      value: data.employees.toString(),
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Ola, {session?.user?.name?.split(" ")[0]}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Resumo financeiro de{" "}
          {now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {card.value}
                  </p>
                </div>
                <div className={`${card.bgColor} p-3 rounded-lg`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Saldo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Saldo do Mes
        </h3>
        <p
          className={`text-3xl font-bold ${
            balance >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {formatCurrency(balance)}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Receitas - Despesas
        </p>
      </div>
    </div>
  );
}
