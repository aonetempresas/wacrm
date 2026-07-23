-- ============================================================
-- 039_contact_market_intel.sql — Contact "market intelligence" fields
-- (Aonet briefing 4.4 / field dictionary seção 8)
--
-- Adds optional customer-context columns to `contacts` — the info that
-- enriches a lead and, aggregated, becomes a market map:
--   * city                   — cidade (cobertura / B2G)
--   * current_operator       — operadora atual (L5), single select
--   * current_monthly_price  — valor que o cliente paga hoje (R$)
--   * pain_points            — necessidade/dor (L7), MULTI select
--   * pain_note              — free text for "outro" / extra detail
--
-- Design / safety
--   - PURELY ADDITIVE, all nullable (pain_points defaults to '{}'). No
--     existing column touched, so nothing that reads `contacts` breaks.
--   - These live on the CONTACT (they describe the customer/company),
--     not the deal — the deal already carries temperature/channel/
--     products (migration 038).
--   - Slugs (operator, pains) are app-managed constants for now
--     (AONET_OPERATORS / AONET_PAINS), same approach as 038.
--   - Columns inherit the table's existing RLS.
--
-- Idempotent — safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS city                  text,
  ADD COLUMN IF NOT EXISTS current_operator      text,
  ADD COLUMN IF NOT EXISTS current_monthly_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS pain_points           text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pain_note             text;

-- For the future "de qual operadora mais ganhamos/perdemos" and
-- coverage-by-city analytics. Partial: only index rows that set it.
CREATE INDEX IF NOT EXISTS idx_contacts_current_operator
  ON contacts (current_operator) WHERE current_operator IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_city
  ON contacts (city) WHERE city IS NOT NULL;
