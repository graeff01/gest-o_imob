import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/server/api-response";
import { requireAuth } from "@/server/authz";

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

export async function GET(request: Request) {
  try {
    await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);

  try {
    const [employees, payrolls, commissions, advances] = await Promise.all([
      prisma.employee.findMany({
        where: { is_active: true },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.payrollEntry.findMany({
        where: { reference_year: year, reference_month: month },
        include: { employee: { include: { user: { select: { name: true } } } } },
        orderBy: { created_at: "desc" },
      }),
      prisma.commissionCalculation.findMany({
        where: { reference_year: year, reference_month: month },
        select: {
          employee_id: true,
          total_commission: true,
          rental_count: true,
          capture_count: true,
          status: true,
        },
      }),
      prisma.commissionAdvance.findMany({
        where: { status: { in: ["PENDENTE", "PARCIALMENTE_QUITADO", "VENCIDO"] } },
        select: { employee_id: true, amount: true, status: true },
      }),
    ]);

    const payrollByEmployee = new Map(payrolls.map((entry) => [entry.employee_id, entry]));
    const commissionByEmployee = new Map(commissions.map((entry) => [entry.employee_id, entry]));
    const advancesByEmployee = advances.reduce<Map<string, number>>((acc, advance) => {
      acc.set(advance.employee_id, (acc.get(advance.employee_id) ?? 0) + toNumber(advance.amount));
      return acc;
    }, new Map());

    const rows = employees.map((employee) => {
      const payroll = payrollByEmployee.get(employee.id);
      const commission = commissionByEmployee.get(employee.id);
      const baseSalary = toNumber(payroll?.base_salary ?? employee.base_salary);
      const commissionAmount = toNumber(payroll?.commission ?? commission?.total_commission);
      const benefits = toNumber(payroll?.food_allowance) + toNumber(payroll?.transport_allowance);
      const deductions = toNumber(payroll?.total_deductions);
      const gross = payroll ? toNumber(payroll.total_gross) : baseSalary + commissionAmount + benefits;
      const net = payroll ? toNumber(payroll.total_net) : gross - deductions;

      return {
        employeeId: employee.id,
        name: employee.user.name,
        email: employee.user.email,
        position: employee.position,
        department: employee.department,
        contractType: employee.contract_type,
        baseSalary,
        commission: commissionAmount,
        benefits,
        deductions,
        gross,
        net,
        status: payroll?.status ?? "RASCUNHO",
        payrollId: payroll?.id ?? null,
        commissionStatus: commission?.status ?? null,
        rentalCount: commission?.rental_count ?? 0,
        captureCount: commission?.capture_count ?? 0,
        openAdvances: advancesByEmployee.get(employee.id) ?? 0,
      };
    });

    return NextResponse.json({
      reference: { month, year, label: `${String(month).padStart(2, "0")}/${year}` },
      rows,
      summary: {
        employees: rows.length,
        payrolls: payrolls.length,
        gross: rows.reduce((sum, row) => sum + row.gross, 0),
        net: rows.reduce((sum, row) => sum + row.net, 0),
        commissions: rows.reduce((sum, row) => sum + row.commission, 0),
        advances: rows.reduce((sum, row) => sum + row.openAdvances, 0),
      },
    });
  } catch (error) {
    console.error("[payroll-overview] error:", error);
    return NextResponse.json({ error: "Erro ao consolidar folha real." }, { status: 500 });
  }
}
