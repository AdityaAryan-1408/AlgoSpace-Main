-- Migration 002: Enable Row Level Security (RLS)
-- This migration enables RLS on all tables to resolve Supabase security warnings
-- and ensures users can only access their own data.

-- 1. Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_topic_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stress_mode_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stress_mode_session_cards ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for tables with a direct user_id
-- (Assuming auth.uid() corresponds to users.id and the user_id column)

-- Users
CREATE POLICY "Users can manage their own profile" ON users
  FOR ALL USING (auth.uid() = id);

-- Cards
CREATE POLICY "Users can manage their own cards" ON cards
  FOR ALL USING (auth.uid() = user_id);

-- Reviews
CREATE POLICY "Users can manage their own reviews" ON reviews
  FOR ALL USING (auth.uid() = user_id);

-- Push Subscriptions
CREATE POLICY "Users can manage their own push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Goals
CREATE POLICY "Users can manage their own goals" ON goals
  FOR ALL USING (auth.uid() = user_id);

-- Coach Snapshots
CREATE POLICY "Users can manage their own coach snapshots" ON coach_snapshots
  FOR ALL USING (auth.uid() = user_id);

-- Chat Threads
CREATE POLICY "Users can manage their own chat threads" ON chat_threads
  FOR ALL USING (auth.uid() = user_id);

-- Stress Mode Sessions
CREATE POLICY "Users can manage their own stress mode sessions" ON stress_mode_sessions
  FOR ALL USING (auth.uid() = user_id);

-- 3. Create policies for child tables (joined via a parent table)

-- Goal Targets
CREATE POLICY "Users can manage targets for their goals" ON goal_targets
  FOR ALL USING (EXISTS (SELECT 1 FROM goals WHERE id = goal_targets.goal_id AND user_id = auth.uid()));

-- Goal Topic Items
CREATE POLICY "Users can manage topic items for their goals" ON goal_topic_items
  FOR ALL USING (EXISTS (SELECT 1 FROM goals WHERE id = goal_topic_items.goal_id AND user_id = auth.uid()));

-- Chat Messages
CREATE POLICY "Users can manage messages in their threads" ON chat_messages
  FOR ALL USING (EXISTS (SELECT 1 FROM chat_threads WHERE id = chat_messages.thread_id AND user_id = auth.uid()));

-- Stress Mode Session Cards
CREATE POLICY "Users can manage cards in their sessions" ON stress_mode_session_cards
  FOR ALL USING (EXISTS (SELECT 1 FROM stress_mode_sessions WHERE id = stress_mode_session_cards.session_id AND user_id = auth.uid()));
