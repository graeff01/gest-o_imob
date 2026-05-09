import { NextResponse } from "next/server";
import { ZodError } from "zod/v4";
import { AuthError } from "@/server/authz";

export class ApiRouteError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type JsonRecord = Record<string, unknown>;

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  [key: string]: unknown;
}

export function apiSuccess<T extends JsonRecord>(payload: T, status = 200) {
  return NextResponse.json(payload, { status });
}

export function apiCreated<T extends JsonRecord>(payload: T) {
  return apiSuccess(payload, 201);
}

export function apiList<T>(
  key: string,
  items: T[],
  meta: PaginationMeta,
  extra?: JsonRecord,
) {
  return apiSuccess({
    [key]: items,
    ...meta,
    ...(extra ?? {}),
  });
}

export function apiError(
  message: string,
  status = 500,
  code?: string,
  details?: unknown,
) {
  return NextResponse.json(
    {
      error: message,
      ...(code ? { code } : {}),
      ...(details !== undefined ? { details } : {}),
    },
    { status },
  );
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return apiError(error.message, error.status, "AUTH_ERROR");
  }

  console.error("API auth error:", error);
  return apiError("Erro de autenticacao.", 500, "AUTH_INTERNAL_ERROR");
}

export function handleApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof AuthError) {
    return apiError(error.message, error.status, "AUTH_ERROR");
  }

  if (error instanceof ApiRouteError) {
    return apiError(error.message, error.status, error.code, error.details);
  }

  if (error instanceof ZodError) {
    return apiError("Dados invalidos.", 400, "VALIDATION_ERROR", error.issues);
  }

  console.error(fallbackMessage, error);
  return apiError(fallbackMessage, 500, "INTERNAL_ERROR");
}
