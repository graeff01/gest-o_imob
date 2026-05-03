import "server-only";
import type { InputJsonValue } from "@prisma/client/runtime/client";
import { prisma } from "@/lib/prisma";
import { ensureFoundationSchema } from "@/server/foundation-schema";

type AuditAction =
  | "invoice.created"
  | "invoice.updated"
  | "invoice.emit.attempted"
  | "invoice.emit.succeeded"
  | "invoice.emit.failed"
  | "invoice.import.previewed"
  | "invoice.import.confirmed"
  | "invoice.import.cleaned"
  | "bank_statement.cleaned"
  | "record.created"
  | "record.updated"
  | "record.deleted"
  | "settings.updated";

interface AuditPayload {
  action: AuditAction;
  actorId?: string;
  actorEmail?: string;
  actorType?: "HUMAN" | "AUTOMATION" | "SYSTEM";
  entityId?: string;
  entityType?: string;
  entityLabel?: string;
  summary: string;
  severity?: "INFO" | "WARN" | "CRITICAL";
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

function sanitizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  const redactedKeys = new Set(["cpf", "cnpj", "cpf_cnpj", "client_cpf_cnpj", "password", "token"]);
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      redactedKeys.has(key.toLowerCase()) ? "[redacted]" : value,
    ])
  );
}

function asJson(value: unknown): InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as InputJsonValue;
}

export async function auditEvent(payload: AuditPayload) {
  const event = {
    ...payload,
    metadata: sanitizeMetadata(payload.metadata),
    at: new Date().toISOString(),
  };

  try {
    await ensureFoundationSchema();
    await prisma.auditEvent.create({
      data: {
        action: payload.action,
        actor_id: payload.actorId ?? null,
        actor_email: payload.actorEmail ?? null,
        actor_type: payload.actorType ?? (payload.actorId ? "HUMAN" : "SYSTEM"),
        entity_id: payload.entityId ?? null,
        entity_type: payload.entityType ?? null,
        entity_label: payload.entityLabel ?? null,
        summary: payload.summary,
        severity: payload.severity ?? "INFO",
        metadata: event.metadata ? asJson(event.metadata) : undefined,
        ip_address: payload.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.info("[audit]", JSON.stringify(event));
    console.error("[audit] persist failed:", error);
  }
}
