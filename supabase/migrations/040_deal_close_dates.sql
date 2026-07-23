-- ============================================================
-- 040_deal_close_dates.sql — when a deal was won / lost
--
-- Adds timestamps so the funnel can move won deals out to a "Ganhos"
-- view with a real date filter ("fechados este mês"), and so the
-- future results dashboard can compute MRR novo per month precisely.
--   * won_at  — set when the deal is marked won (cleared on reopen)
--   * lost_at — set when the deal is marked lost (cleared on reopen)
--
-- Purely additive, both nullable. No existing column touched. The app
-- sets these in the deal-form status actions; the columns inherit the
-- table's existing RLS.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS won_at  timestamptz,
  ADD COLUMN IF NOT EXISTS lost_at timestamptz;

-- Hot filter for the Ganhos view / monthly results.
CREATE INDEX IF NOT EXISTS idx_deals_won_at
  ON deals (won_at) WHERE won_at IS NOT NULL;
