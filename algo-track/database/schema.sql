-- AlgoTrack PostgreSQL schema
-- Run this file once against your Supabase/Postgres database.
-- Safe to re-run: drops and recreates everything.

-- Drop existing tables (reverse dependency order)
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_threads CASCADE;
DROP TABLE IF EXISTS coach_snapshots CASCADE;
DROP TABLE IF EXISTS goal_topic_items CASCADE;
DROP TABLE IF EXISTS goal_targets CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing enum types
DROP TYPE IF EXISTS review_rating CASCADE;
DROP TYPE IF EXISTS card_difficulty CASCADE;
DROP TYPE IF EXISTS card_type CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_type') THEN
    CREATE TYPE card_type AS ENUM ('leetcode', 'cs');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_difficulty') THEN
    CREATE TYPE card_difficulty AS ENUM ('easy', 'medium', 'hard');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_rating') THEN
    CREATE TYPE review_rating AS ENUM ('AGAIN', 'HARD', 'GOOD', 'EASY');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type card_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT,
  notes TEXT NOT NULL DEFAULT '',
  solution TEXT,
  difficulty card_difficulty NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  -- New fields for AlgoTrack expansion
  source TEXT NOT NULL DEFAULT 'manual',
  solved_at TIMESTAMPTZ,
  topic_domain TEXT,
  topic_ids TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- SRS fields
  easiness_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetition_count INTEGER NOT NULL DEFAULT 0,
  last_rating review_rating,
  last_reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  rating review_rating NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_ms INTEGER,
  interval_days INTEGER NOT NULL,
  easiness_factor NUMERIC(4,2) NOT NULL,
  repetition_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Goals ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goal_type TEXT NOT NULL,           -- dsa_volume | dsa_retention | cs_topic_completion | hybrid_prep_plan
  status TEXT NOT NULL DEFAULT 'active', -- draft | active | completed | paused | abandoned
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goal_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,          -- problems_solved | retained_pct | topics_completed
  target_value NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,                -- problems | percent | topics
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goal_topic_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  topic_domain TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started | in_progress | completed | blocked
  deadline DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Coach / AI ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coach_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL,       -- profile_overview | weakness_analysis | goal_status
  input_hash TEXT NOT NULL,          -- hash of the input data to detect staleness
  summary JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Chat ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  mode TEXT NOT NULL,                -- debug_logic | system_design_review | theory_cross_question | interviewer_mode
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                -- system | user | assistant
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Stress Mode ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stress_mode_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- active | completed | abandoned
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INT NOT NULL DEFAULT 0,
  cards_completed INT NOT NULL DEFAULT 0,
  total_cards INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stress_mode_session_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES stress_mode_sessions(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  presented_order INT NOT NULL,
  completed_at TIMESTAMPTZ,
  rating TEXT,
  time_spent_ms INT
);

-- ── Indexes ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cards_user_next_review
  ON cards (user_id, next_review_at);

CREATE INDEX IF NOT EXISTS idx_cards_user_source
  ON cards (user_id, source);

CREATE INDEX IF NOT EXISTS idx_cards_user_topic_domain
  ON cards (user_id, topic_domain);

CREATE INDEX IF NOT EXISTS idx_cards_user_solved_at
  ON cards (user_id, solved_at);

CREATE INDEX IF NOT EXISTS idx_reviews_user_reviewed_at
  ON reviews (user_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_card_reviewed_at
  ON reviews (card_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions (user_id);

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

-- ── Triggers ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cards_updated_at ON cards;
CREATE TRIGGER trg_cards_updated_at
BEFORE UPDATE ON cards
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

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
