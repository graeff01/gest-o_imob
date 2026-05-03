import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse } from "@/server/api-response";
import { requireAuth } from "@/server/authz";

type AuditEvent = {
  id: string;
  timestamp: string;
  actor: string;
  actorType: "HUMAN" | "AUTOMATION" | "SYSTEM";
  action: string;
  entityType: string;
  entityLabel: string;
  summary: string;
  severity: "INFO" | "WARN" | "CRITICAL";
};

export async function GET() {
  try {
    await requireAuth();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const [invoices, documents, bankTransactions, webhooks] = await Promise.all([
      prisma.invoice.findMany({
        orderBy: { updated_at: "desc" },
        take: 120,
        select: { id: true, status: true, client_name: true, amount: true, updated_at: true, created_at: true, emit_attempts: true, last_emit_error: true },
      }),
      prisma.document.findMany({
        orderBy: { updated_at: "desc" },
        take: 80,
        select: { id: true, original_filename: true, document_type: true, processing_status: true, updated_at: true, created_at: true, is_reviewed: true },
      }),
      prisma.bankTransaction.findMany({
        orderBy: [{ updated_at: "desc" }],
        take: 100,
        select: { id: true, description: true, amount: true, is_credit: true, is_reconciled: true, needs_review: true, updated_at: true, created_at: true },
      }),
      prisma.webhookLog.findMany({
        orderBy: { received_at: "desc" },
        take: 80,
        select: { id: true, provider: true, event_type: true, processed: true, signature_valid: true, error_message: true, received_at: true },
      }),
    ]);

    const events: AuditEvent[] = [
      ...invoices.map((invoice) => ({
        id: `invoice-${invoice.id}`,
        timestamp: invoice.updated_at.toISOString(),
        actor: invoice.emit_attempts > 0 ? "Gateway NFS-e" : "Sistema",
        actorType: invoice.emit_attempts > 0 ? "AUTOMATION" as const : "SYSTEM" as const,
        action: invoice.status === "ERRO" ? "EMISSION_ERROR" : invoice.emit_attempts > 0 ? "NFS_STATUS" : "NFS_CREATED",
        entityType: "Nota fiscal",
        entityLabel: invoice.client_name,
        summary: `Nota ${invoice.status.toLowerCase()} para ${invoice.client_name}. Valor: R$ ${Number(invoice.amount).toFixed(2)}.`,
        severity: invoice.status === "ERRO" || invoice.last_emit_error ? "CRITICAL" as const : "INFO" as const,
      })),
      ...documents.map((document) => ({
        id: `document-${document.id}`,
        timestamp: document.updated_at.toISOString(),
        actor: "Sistema",
        actorType: "SYSTEM" as const,
        action: document.processing_status === "ERRO" ? "DOCUMENT_ERROR" : "DOCUMENT_PROCESSING",
        entityType: "Documento",
        entityLabel: document.original_filename,
        summary: `${document.document_type} ${document.processing_status.toLowerCase()}${document.is_reviewed ? " e revisado" : ""}.`,
        severity: document.processing_status === "ERRO" ? "WARN" as const : "INFO" as const,
      })),
      ...bankTransactions.map((tx) => ({
        id: `bank-${tx.id}`,
        timestamp: tx.updated_at.toISOString(),
        actor: "Importador de extrato",
        actorType: "AUTOMATION" as const,
        action: tx.needs_review ? "BANK_REVIEW" : tx.is_reconciled ? "BANK_RECONCILED" : "BANK_IMPORTED",
        entityType: "Transacao bancaria",
        entityLabel: tx.description,
        summary: `${tx.is_credit ? "Entrada" : "Saida"} de R$ ${Number(tx.amount).toFixed(2)} ${tx.is_reconciled ? "conciliada" : "pendente"}.`,
        severity: tx.needs_review ? "WARN" as const : "INFO" as const,
      })),
      ...webhooks.map((webhook) => ({
        id: `webhook-${webhook.id}`,
        timestamp: webhook.received_at.toISOString(),
        actor: webhook.provider,
        actorType: "AUTOMATION" as const,
        action: webhook.processed ? "WEBHOOK_PROCESSED" : "WEBHOOK_RECEIVED",
        entityType: "Webhook",
        entityLabel: webhook.event_type ?? webhook.provider,
        summary: webhook.error_message ?? `${webhook.event_type ?? "Evento"} recebido de ${webhook.provider}.`,
        severity: !webhook.signature_valid || webhook.error_message ? "CRITICAL" as const : webhook.processed ? "INFO" as const : "WARN" as const,
      })),
    ].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 300);

    return NextResponse.json({
      events,
      summary: {
        total: events.length,
        automation: events.filter((event) => event.actorType !== "HUMAN").length,
        critical: events.filter((event) => event.severity === "CRITICAL").length,
        warnings: events.filter((event) => event.severity === "WARN").length,
      },
    });
  } catch (error) {
    console.error("[audit-overview] error:", error);
    return NextResponse.json({ error: "Erro ao montar auditoria real." }, { status: 500 });
  }
}
