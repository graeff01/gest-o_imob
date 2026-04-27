import { NextResponse } from "next/server";
import { appConfig } from "@/server/env";

export function canUseMockFallback() {
  return appConfig.isLocal && appConfig.allowMockFallbacks;
}

export function mockFallbackBlockedResponse(scope: string) {
  return NextResponse.json(
    {
      error: "Banco indisponivel ou sem dados reais.",
      code: "MOCK_FALLBACK_BLOCKED",
      scope,
      detail: "Fallback mock esta bloqueado. Use ALLOW_MOCK_FALLBACKS=true apenas em ambiente local.",
    },
    { status: 503 }
  );
}
