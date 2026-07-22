-- ============================================================
-- 038_lead_qualification.sql — Lead qualification fields (Aonet CRM, Fase A)
--
-- Adds optional qualification columns to `deals` (the opportunity /
-- lead card in the funnel), per the Aonet briefing:
--   * temperature     — 4.2  quente / morno / frio (subjective heat)
--   * source_channel  — 4.1  where the lead came from (L1)
--   * monthly_value   — 4.3  MRR: the recurring monthly amount (R$/mês)
--   * setup_value     — 4.3  one-time install/setup fee (optional)
--   * products        — L4   products of interest (multi-select)
--   * lost_reasons    — L6   reason(s) for a lost deal (multi-select)
--   * lost_reason_note — free text for "Outro" / extra detail on loss
--
-- Design notes / safety
--   - PURELY ADDITIVE. Every column is nullable (or defaults to an
--     empty array). No existing column is touched, so nothing that
--     reads `deals` today (dashboard, pipeline analytics, deal-form)
--     breaks. The legacy `value` column stays as-is; MRR lives in the
--     new `monthly_value` so current totals keep working until a later
--     phase migrates the dashboards to MRR.
--   - Multi-selects (products, lost_reasons) are stored as text[]
--     rather than junction tables: the option lists are short, app-
--     managed constants for now (the briefing's L1/L4/L6, not yet
--     validated by the manager), so arrays keep it simple and avoid
--     extra tables/RLS. A future "editable lists" feature can migrate
--     these to lookup tables if needed.
--   - temperature has a CHECK (the 3 values are fixed and won't
--     change). source_channel has NO check on purpose — the channel
--     list is expected to evolve, and a CHECK would block edits.
--   - No new RLS: the columns inherit the table's existing policies.
--
-- Idempotent — safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS temperature      text
    CHECK (temperature IS NULL OR temperature IN ('quente','morno','frio')),
  ADD COLUMN IF NOT EXISTS source_channel   text,
  ADD COLUMN IF NOT EXISTS monthly_value    numeric(12,2),
  ADD COLUMN IF NOT EXISTS setup_value      numeric(12,2),
  ADD COLUMN IF NOT EXISTS products         text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lost_reasons     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lost_reason_note text;

-- Lightweight indexes for the analytics we'll build later
-- (conversion by channel, heat breakdown). Partial: only index rows
-- that actually set the field, so the index stays small.
CREATE INDEX IF NOT EXISTS idx_deals_source_channel
  ON deals (source_channel) WHERE source_channel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_temperature
  ON deals (temperature) WHERE temperature IS NOT NULL;
