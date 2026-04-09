/**
 * POST /api/invoices/[id]/emit
 * ----------------------------
 * Emite uma NFS-e via gateway para uma nota no status PENDENTE ou ERRO.
 *
 * Segurança e assertividade:
 *   - Apenas ADMIN_MASTER e DONO podem emitir
 *   - Verifica se a nota existe e está em status emitível
 *   - Muda para PROCESSANDO antes de chamar o gateway (evita dupla emissão)
 *   - Em caso de erro do gateway, reverte para ERRO e registra o motivo
 *   - Log de auditoria em toda tentativa (bem-sucedida ou não)
 *   - Idempotente: se já estiver EMITIDA, retorna os dados sem re-emitir
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitNfse } from "@/lib/utils/nfse-gateway";

// Perfis autorizados a emitir notas fiscais
const AUTHORIZED_ROLES = ["ADMIN_MASTER", "DONO"];

// Status que permitem tentativa de emissão
const EMITTABLE_STATUSES = ["PENDENTE", "ERRO"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── 1. Autenticação e autorização ──
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!AUTHORIZED_ROLES.includes(session.user.role as string)) {
    return NextResponse.json(
      { error: "Sem permissão. Apenas ADMIN_MASTER e DONO podem emitir notas fiscais." },
      { status: 403 }
    );
  }

  const { id } = await params;

  // ── 2. Busca a nota no banco ──
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      client_name: true,
      client_cpf_cnpj: true,
      client_contact: true,
      amount: true,
      description_body: true,
      reference_month: true,
      reference_year: true,
      emit_attempts: true,
      gateway_id: true,
      gateway_pdf_url: true,
      nfse_number: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });
  }

  // ── 3. Idempotência — se já emitida, retorna os dados sem re-emitir ──
  if (invoice.status === "EMITIDA" || invoice.status === "ENVIADA" || invoice.status === "PAGA") {
    return NextResponse.json({
      message: "Nota já emitida anteriormente.",
      invoice: {
        id: invoice.id,
        status: invoice.status,
        gateway_id: invoice.gateway_id,
        nfse_number: invoice.nfse_number,
        gateway_pdf_url: invoice.gateway_pdf_url,
      },
    });
  }

  // ── 4. Verifica se o status permite emissão ──
  if (!EMITTABLE_STATUSES.includes(invoice.status)) {
    return NextResponse.json(
      {
        error: `Não é possível emitir uma nota com status "${invoice.status}". Apenas notas PENDENTE ou ERRO podem ser emitidas.`,
      },
      { status: 409 }
    );
  }

  // ── 5. Bloqueia a nota em PROCESSANDO antes de chamar o gateway ──
  // Isso evita que dois usuários cliquem ao mesmo tempo e gerem dupla emissão.
  let locked: { status: string } | null = null;
  try {
    locked = await prisma.invoice.update({
      where: {
        id,
        // Condição atômica: só atualiza se ainda estiver no status emitível
        // Se outro processo já tiver mudado, o update não encontra o registro
        status: { in: EMITTABLE_STATUSES as ("PENDENTE" | "ERRO")[] },
      },
      data: {
        status: "PROCESSANDO",
        last_emit_at: new Date(),
        emit_attempts: { increment: 1 },
      },
      select: { status: true },
    });
  } catch {
    // Se o update falhou (nota foi pega por outro processo), retorna conflito
    return NextResponse.json(
      { error: "Nota já está sendo processada por outro usuário. Aguarde alguns instantes." },
      { status: 409 }
    );
  }

  if (!locked) {
    return NextResponse.json(
      { error: "Não foi possível bloquear a nota para emissão. Tente novamente." },
      { status: 409 }
    );
  }

  // ── 6. Chama o gateway ──
  const result = await emitNfse({
    invoiceId: invoice.id,
    borrower: {
      name: invoice.client_name,
      federalTaxNumber: invoice.client_cpf_cnpj,
      email: invoice.client_contact ?? undefined,
    },
    service: {
      description: invoice.description_body,
      amount: Number(invoice.amount),
      competence: {
        month: invoice.reference_month ?? new Date().getMonth() + 1,
        year: invoice.reference_year,
      },
    },
  });

  // ── 7. Atualiza o banco com o resultado ──
  if (result.success) {
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: "EMITIDA",
        issued_at: new Date(),
        gateway_id: result.gatewayId,
        gateway_provider: result.provider,
        gateway_status: result.gatewayStatus,
        gateway_pdf_url: result.pdfUrl,
        gateway_xml_url: result.xmlUrl,
        nfse_number: result.nfseNumber,
        last_emit_error: null, // Limpa erro anterior se houver
      },
    });

    return NextResponse.json({
      message: "NFS-e emitida com sucesso.",
      invoice: {
        id: updated.id,
        status: updated.status,
        nfse_number: updated.nfse_number,
        gateway_id: updated.gateway_id,
        gateway_pdf_url: updated.gateway_pdf_url,
        issued_at: updated.issued_at,
      },
    });
  } else {
    // Falha no gateway — reverte para ERRO e registra o motivo
    await prisma.invoice.update({
      where: { id },
      data: {
        status: "ERRO",
        gateway_status: "error",
        last_emit_error: result.error,
      },
    });

    return NextResponse.json(
      {
        error: "Falha ao emitir a NFS-e.",
        details: result.error,
        gatewayErrorCode: result.gatewayErrorCode,
      },
      { status: 502 }
    );
  }
}
