-- =============================================================================
-- StudySpace - Focus Garden Plant System Migration
-- File: supabase/focus_garden_migration.sql
-- =============================================================================
-- Description:
--   Adds a garden_plants table to track each individual plant the user earns
--   every 30 minutes of accumulated active focus time.
--
--   Each plant has:
--     - its own UUID
--     - the user who owns it
--     - which 30-minute milestone created it (planted_at_seconds)
--     - its species/variant for visual variety
--     - a creation timestamp
--
--   Growth stage is DERIVED at runtime:
--     stage = floor((total_focus_seconds - planted_at_seconds) / 1800)
--   clamped to [0, MAX_STAGE].
--
--   This makes it completely safe to re-derive on every page load with no
--   possibility of corruption or stale cached stages.
--
-- Instructions:
--   1. Open your Supabase project → SQL Editor → New Query
--   2. Paste this entire file and click Run
--   3. You should see "Success. No rows returned"
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. Table: garden_plants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.garden_plants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- The cumulative total focus-seconds at which this plant was "planted".
    -- Used to derive each plant's individual growth stage relative to the
    -- user's current total focus time.
    planted_at_seconds  INTEGER NOT NULL CHECK (planted_at_seconds >= 0),

    -- Visual variety (0-4) so the garden looks diverse
    species_variant     SMALLINT NOT NULL DEFAULT 0 CHECK (species_variant BETWEEN 0 AND 4),

    -- Optional custom name (future feature)
    nickname            TEXT,

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE  public.garden_plants IS 'One row per plant earned in the Focus Garden. Each plant is earned at a 30-minute (1800s) active-focus milestone.';
COMMENT ON COLUMN public.garden_plants.planted_at_seconds IS 'Total user focus-seconds when this plant was planted. Growth stage = floor((current_total - planted_at_seconds) / 1800).';

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_garden_plants_user
    ON public.garden_plants (user_id, planted_at_seconds ASC);

-- Unique: one plant per milestone per user (prevents duplicates on network retry)
CREATE UNIQUE INDEX IF NOT EXISTS idx_garden_plants_user_milestone
    ON public.garden_plants (user_id, planted_at_seconds);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.garden_plants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own garden plants"   ON public.garden_plants;
DROP POLICY IF EXISTS "Users can insert own garden plants" ON public.garden_plants;
DROP POLICY IF EXISTS "Users can update own garden plants" ON public.garden_plants;
DROP POLICY IF EXISTS "Users can delete own garden plants" ON public.garden_plants;

CREATE POLICY "Users can read own garden plants"
    ON public.garden_plants FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own garden plants"
    ON public.garden_plants FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own garden plants"
    ON public.garden_plants FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own garden plants"
    ON public.garden_plants FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Permissions
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garden_plants TO authenticated;
