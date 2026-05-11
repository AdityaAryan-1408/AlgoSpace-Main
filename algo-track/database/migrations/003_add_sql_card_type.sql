-- Migration: Add 'sql' to card_type ENUM
-- Run this on your existing Supabase/Postgres database to add the SQL category.
-- Safe to re-run: uses IF NOT EXISTS pattern.

ALTER TYPE card_type ADD VALUE IF NOT EXISTS 'sql';
