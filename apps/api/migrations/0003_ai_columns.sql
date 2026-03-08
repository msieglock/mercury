-- Mercury: Add AI-related columns to users table
-- Migration: 0003_ai_columns

ALTER TABLE users ADD COLUMN style_fingerprint TEXT;
ALTER TABLE users ADD COLUMN mode TEXT NOT NULL DEFAULT 'sales';
