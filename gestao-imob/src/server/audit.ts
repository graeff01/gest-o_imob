import "server-only";

type AuditAction =
  | "invoice.created"
  | "invoice.updated"
  | "invoice.emit.attempted"
  | "invoice.emit.succeeded"
  | "invoice.emit.failed"
  | "invoice.import.previewed"
  | "invoice.import.confirmed";

interface AuditPayload {
  action: AuditAction;
  actorId?: string;
  entityId?: string;
  entityType?: "invoice" | "import_batch";
  summary: string;
  metadata?: Record<string, unknown>;
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

export async function auditEvent(payload: AuditPayload) {
  const event = {
    ...payload,
    metadata: sanitizeMetadata(payload.metadata),
    at: new Date().toISOString(),
  };

  // Estrutura intencional: hoje log local; em homolog/PRD trocar por tabela audit_events.
  console.info("[audit]", JSON.stringify(event));
}
