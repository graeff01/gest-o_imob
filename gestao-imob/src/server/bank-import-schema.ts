import { prisma } from "@/lib/prisma";

let ensured = false;

export async function ensureBankImportSchema() {
  if (ensured) return;

  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await prisma.$executeRawUnsafe("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS normalized_key TEXT");
  await prisma.$executeRawUnsafe("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS counterparty TEXT");
  await prisma.$executeRawUnsafe("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS classification_label TEXT");
  await prisma.$executeRawUnsafe("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS classification_rule TEXT");
  await prisma.$executeRawUnsafe(
    "ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS classification_confidence INTEGER NOT NULL DEFAULT 0"
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'IMPORTED'"
  );
  await prisma.$executeRawUnsafe("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS status_reason TEXT");
  await prisma.$executeRawUnsafe(
    "ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false"
  );
  await prisma.$executeRawUnsafe("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP");
  await prisma.$executeRawUnsafe("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS reviewed_by TEXT");
  await prisma.$executeRawUnsafe("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS classified_by_rule_id TEXT");
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS bank_transactions_needs_review_idx ON bank_transactions(needs_review)"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS bank_transactions_processing_status_idx ON bank_transactions(processing_status)"
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS bank_classification_rules (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      pattern TEXT NOT NULL,
      normalized_pattern TEXT NOT NULL,
      kind TEXT NOT NULL,
      category_id TEXT,
      category_label TEXT NOT NULL,
      revenue_category TEXT,
      department TEXT NOT NULL,
      payment_method TEXT,
      priority INTEGER NOT NULL DEFAULT 100,
      scope_bank_account_id TEXT,
      match_mode TEXT NOT NULL DEFAULT 'CONTAINS',
      amount_min DECIMAL(14, 2),
      amount_max DECIMAL(14, 2),
      confidence INTEGER NOT NULL DEFAULT 100,
      use_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(
    "ALTER TABLE bank_classification_rules ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100"
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE bank_classification_rules ADD COLUMN IF NOT EXISTS scope_bank_account_id TEXT"
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE bank_classification_rules ADD COLUMN IF NOT EXISTS match_mode TEXT NOT NULL DEFAULT 'CONTAINS'"
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE bank_classification_rules ADD COLUMN IF NOT EXISTS amount_min DECIMAL(14, 2)"
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE bank_classification_rules ADD COLUMN IF NOT EXISTS amount_max DECIMAL(14, 2)"
  );
  await prisma.$executeRawUnsafe(
    "CREATE UNIQUE INDEX IF NOT EXISTS bank_classification_rules_pattern_kind_key ON bank_classification_rules(normalized_pattern, kind)"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS bank_classification_rules_is_active_idx ON bank_classification_rules(is_active)"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS bank_classification_rules_priority_idx ON bank_classification_rules(priority)"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS bank_classification_rules_scope_bank_account_idx ON bank_classification_rules(scope_bank_account_id)"
  );

  ensured = true;
}
