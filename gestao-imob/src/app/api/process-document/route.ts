import { NextResponse } from "next/server";
import { AuthError, requireElevatedRole } from "@/server/authz";

export async function POST() {
  try {
    await requireElevatedRole();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro de autenticacao." }, { status: 500 });
  }

  return NextResponse.json(
    {
      error: "Roteamento automatico de documentos desativado.",
      detail:
        "Esta rota dependia de simulacao. Reative somente depois que o banco real estiver conectado e o fluxo gravar dados reais com auditoria.",
    },
    { status: 503 }
  );
}
