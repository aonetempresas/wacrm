-- ============================================================
-- 037_tasks.sql — Agenda / Tarefas / Lembretes (sales tasks)
--
-- Adds the `tasks` table: a per-account, per-agent to-do / agenda
-- so each salesperson organizes their week (calls, meetings,
-- follow-ups) tied to the leads (contacts) and opportunities
-- (deals) they already work. Purely additive — no existing table
-- is modified.
--
-- Design notes
--   - Account-scoped (tenancy = account_id), never user-scoped.
--     Scales to any number of members: a task is assigned to one
--     agent via `assigned_to` (auth.users.id — the same target as
--     notifications.user_id / conversations.assigned_agent_id).
--   - `created_by` records who created it (audit only), ON DELETE
--     SET NULL so removing a teammate never cascade-deletes tasks.
--   - Optional links: `contact_id` (the lead), `deal_id` (the
--     opportunity), `conversation_id` (reserved for a future inbox
--     shortcut). All ON DELETE SET NULL so history survives.
--   - `reminded_at` is a guard column for a future reminder cron
--     (unused today); the practical reminder in Phase 1 is the
--     agenda's own Overdue/Today grouping.
--
-- RLS: operational tier (mirrors contacts / contact_notes) — any
-- member reads (viewer+), agent+ writes.
--
-- Idempotent — safe to run multiple times. Table uses IF NOT
-- EXISTS; policies are dropped before recreate (Postgres has no
-- CREATE POLICY IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id         uuid REFERENCES deals(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  type            text NOT NULL DEFAULT 'follow_up'
                    CHECK (type IN ('call','meeting','follow_up','whatsapp','other')),
  priority        text NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','done','cancelled')),
  due_at          timestamptz NOT NULL,
  completed_at    timestamptz,
  reminded_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Every "this account's agenda" query filters on account_id; the
-- other two indexes cover the hot filters (by due date, and by
-- agent + status) so the list stays fast at any member count.
CREATE INDEX IF NOT EXISTS tasks_account_id_idx ON tasks (account_id);
CREATE INDEX IF NOT EXISTS tasks_account_due_idx ON tasks (account_id, due_at);
CREATE INDEX IF NOT EXISTS tasks_account_assignee_status_idx
  ON tasks (account_id, assigned_to, status);

-- Auto-touch updated_at (helper defined in migration 001).
DROP TRIGGER IF EXISTS set_updated_at ON tasks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the account (viewer+) can read the agenda.
DROP POLICY IF EXISTS tasks_select ON tasks;
CREATE POLICY tasks_select ON tasks FOR SELECT
  USING (is_account_member(account_id));

-- INSERT / UPDATE / DELETE: agent+ (operational data).
DROP POLICY IF EXISTS tasks_insert ON tasks;
CREATE POLICY tasks_insert ON tasks FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS tasks_update ON tasks;
CREATE POLICY tasks_update ON tasks FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS tasks_delete ON tasks;
CREATE POLICY tasks_delete ON tasks FOR DELETE
  USING (is_account_member(account_id, 'agent'));

-- Realtime: the agenda page subscribes to task changes so a task
-- created/completed on one device reflects on another. REPLICA
-- IDENTITY FULL so UPDATE/DELETE payloads carry the full row.
ALTER TABLE tasks REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;
END $$;
