import type { AuthContext } from "@/server/authz";
import { auditEvent } from "@/server/audit";

type CrudAction = "created" | "updated" | "deleted";

interface CrudAuditPayload {
  ctx: AuthContext;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  action: CrudAction;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function auditCrud(payload: CrudAuditPayload) {
  const { ctx, entityType, entityId, entityLabel, action, summary, metadata } = payload;

  await auditEvent({
    action: `${entityType}.${action}`,
    actorId: ctx.dbUserId,
    actorEmail: ctx.email,
    actorType: "HUMAN",
    entityType,
    entityId,
    entityLabel: entityLabel ?? undefined,
    summary,
    metadata,
  });
}
