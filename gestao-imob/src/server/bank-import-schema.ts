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
    "ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false"
  );
  await prisma.$executeRawUnsafe("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP");
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS bank_transactions_needs_review_idx ON bank_transactions(needs_review)"
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
      confidence INTEGER NOT NULL DEFAULT 100,
      use_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(
    "CREATE UNIQUE INDEX IF NOT EXISTS bank_classification_rules_pattern_kind_key ON bank_classification_rules(normalized_pattern, kind)"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS bank_classification_rules_is_active_idx ON bank_classification_rules(is_active)"
  );

  ensured = true;
}
