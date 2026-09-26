-- ─── Add photo_url column to journal_entries ────────────────
-- Run this in your Supabase SQL Editor to add photo support to journal entries.
-- This is a non-destructive migration that adds a nullable column.

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS photo_url text;

-- Add a comment for documentation
COMMENT ON COLUMN public.journal_entries.photo_url IS 'Optional data URL for a photo attached to the journal entry';
