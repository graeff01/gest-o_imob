import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEmployeeSchema } from "@/lib/validations/pessoas";
import { hash } from "bcryptjs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { user: { name: { contains: search, mode: "insensitive" as const } } },
          { cpf: { contains: search } },
        ],
      }
    : {};

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ]);

  return NextResponse.json({ employees, total, page, limit });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createEmployeeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Verificar email duplicado
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existingUser) {
    return NextResponse.json(
      { error: "Email ja cadastrado" },
      { status: 409 }
    );
  }

  // Verificar CPF duplicado
  const existingCpf = await prisma.employee.findUnique({
    where: { cpf: data.cpf },
  });
  if (existingCpf) {
    return NextResponse.json(
      { error: "CPF ja cadastrado" },
      { status: 409 }
    );
  }

  const passwordHash = await hash(data.password, 12);

  const employee = await prisma.employee.create({
    data: {
      cpf: data.cpf,
      position: data.position,
      department: data.department,
      contract_type: data.contract_type,
      hire_date: new Date(data.hire_date),
      base_salary: data.base_salary ? parseFloat(data.base_salary) : null,
      user: {
        create: {
          name: data.name,
          email: data.email,
          password_hash: passwordHash,
          role: "MANAGER",
        },
      },
    },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(employee, { status: 201 });
}
