import { NextResponse } from "next/server";
import { getNFSeCompanyConfig } from "@/server/nfse-config";
import { AuthError, requireElevatedRole } from "@/server/authz";

export async function GET() {
  try {
    await requireElevatedRole();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro de autenticacao." }, { status: 500 });
  }

  return NextResponse.json(getNFSeCompanyConfig());
}
