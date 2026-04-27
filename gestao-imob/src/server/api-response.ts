import { NextResponse } from "next/server";
import { AuthError } from "@/server/authz";

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("API auth error:", error);
  return NextResponse.json({ error: "Erro de autenticacao." }, { status: 500 });
}
