-- Migration 001: Data Model Foundation
-- Extends cards table and adds goals, coaching, and chat tables.
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS guards.

-- ── Step 1: Extend cards table ──────────────────────────────────

ALTER TABLE cards ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS solved_at TIMESTAMPTZ;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS topic_domain TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS topic_ids TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── Step 2: Goals ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goal_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goal_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goal_topic_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  topic_domain TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  deadline DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 3: Coach / AI ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coach_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  summary JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 4: Chat ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  mode TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 5: Indexes ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cards_user_source
  ON cards (user_id, source);

CREATE INDEX IF NOT EXISTS idx_cards_user_topic_domain
  ON cards (user_id, topic_domain);

CREATE INDEX IF NOT EXISTS idx_cards_user_solved_at
  ON cards (user_id, solved_at);

CREATE INDEX IF NOT EXISTS idx_goals_user_status
  ON goals (user_id, status);

CREATE INDEX IF NOT EXISTS idx_goal_targets_goal
  ON goal_targets (goal_id);

CREATE INDEX IF NOT EXISTS idx_goal_topic_items_goal
  ON goal_topic_items (goal_id);

CREATE INDEX IF NOT EXISTS idx_coach_snapshots_user_type
  ON coach_snapshots (user_id, snapshot_type);

CREATE INDEX IF NOT EXISTS idx_chat_threads_user
  ON chat_threads (user_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread
  ON chat_messages (thread_id, created_at);

-- ── Step 6: Triggers ────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_goals_updated_at ON goals;
CREATE TRIGGER trg_goals_updated_at
BEFORE UPDATE ON goals
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_goal_topic_items_updated_at ON goal_topic_items;
CREATE TRIGGER trg_goal_topic_items_updated_at
BEFORE UPDATE ON goal_topic_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_chat_threads_updated_at ON chat_threads;
CREATE TRIGGER trg_chat_threads_updated_at
BEFORE UPDATE ON chat_threads
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
