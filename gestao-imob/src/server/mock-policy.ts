import { NextResponse } from "next/server";

export function canUseMockFallback() {
  return false;
}

export function mockFallbackBlockedResponse(scope: string) {
  return NextResponse.json(
    {
      error: "Banco indisponivel ou sem dados reais.",
      code: "MOCK_FALLBACK_BLOCKED",
      scope,
      detail: "Fallback mock removido nesta sprint. A rota deve usar banco real ou retornar erro controlado.",
    },
    { status: 503 }
  );
}
