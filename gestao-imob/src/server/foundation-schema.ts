import "server-only";
import { prisma } from "@/lib/prisma";

let ensured: Promise<void> | null = null;

export function ensureFoundationSchema() {
  ensured ??= (async () => {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARN', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
`);
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_email TEXT,
  actor_type TEXT NOT NULL DEFAULT 'SYSTEM',
  entity_type TEXT,
  entity_id TEXT,
  entity_label TEXT,
  summary TEXT NOT NULL,
  severity "AuditSeverity" NOT NULL DEFAULT 'INFO',
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON audit_events(created_at)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS audit_events_action_idx ON audit_events(action)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS audit_events_entity_type_entity_id_idx ON audit_events(entity_type, entity_id)`);

    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  cpf_cnpj TEXT UNIQUE,
  category_id TEXT REFERENCES expense_categories(id) ON DELETE SET NULL ON UPDATE CASCADE,
  classification_key TEXT UNIQUE,
  default_category TEXT,
  confidence INTEGER NOT NULL DEFAULT 0,
  total_moved DECIMAL(14,2) NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS suppliers_name_idx ON suppliers(name)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS suppliers_is_active_idx ON suppliers(is_active)`);

    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS system_parameter_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scope TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT system_parameter_versions_scope_version_key UNIQUE(scope, version)
)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS system_parameter_versions_scope_is_active_idx ON system_parameter_versions(scope, is_active)`);
  })();

  return ensured;
}
