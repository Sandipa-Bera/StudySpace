-- =============================================================================
-- StudySpace - Pomodoro Timer Database Schema & Security
-- File: supabase/pomodoro_schema.sql
-- =============================================================================
-- Description:
-- Complete schema for tracking Pomodoro focus cycles, breaks, and productivity
-- history with Row Level Security (RLS), automated timestamp triggers, and
-- optimized indexes.
--
-- Instructions to run:
-- 1. Log in to your Supabase Dashboard (https://supabase.com/dashboard).
-- 2. Select your project.
-- 3. In the left navigation, click on the "SQL Editor" icon.
-- 4. Click "+ New query".
-- 5. Paste the entire content of this file into the editor.
-- 6. Click "Run" (or press Ctrl+Enter / Cmd+Enter).
-- 7. Verify the output displays "Success. No rows returned".
-- =============================================================================

-- Enable uuid-ossp extension if not already enabled (Supabase enables by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: pomodoro_sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMPTZ,
    planned_focus_seconds INTEGER NOT NULL CHECK (planned_focus_seconds > 0),
    planned_break_seconds INTEGER NOT NULL DEFAULT 0 CHECK (planned_break_seconds >= 0),
    actual_focus_seconds INTEGER NOT NULL DEFAULT 0 CHECK (actual_focus_seconds >= 0),
    actual_break_seconds INTEGER NOT NULL DEFAULT 0 CHECK (actual_break_seconds >= 0),
    session_status VARCHAR(20) NOT NULL DEFAULT 'in_progress'
        CHECK (session_status IN ('in_progress', 'completed', 'interrupted')),
    current_phase VARCHAR(20) NOT NULL DEFAULT 'focus'
        CHECK (current_phase IN ('focus', 'short_break', 'long_break', 'completed')),
    cycle_number INTEGER NOT NULL DEFAULT 1 CHECK (cycle_number >= 1),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Comments for database documentation
COMMENT ON TABLE public.pomodoro_sessions IS 'Stores Pomodoro focus and break sessions with actual elapsed time and completion states.';
COMMENT ON COLUMN public.pomodoro_sessions.actual_focus_seconds IS 'Actual elapsed focus seconds (excluding pauses and alarm-ringing time).';
COMMENT ON COLUMN public.pomodoro_sessions.actual_break_seconds IS 'Actual elapsed break seconds (excluding pauses and alarm-ringing time).';
COMMENT ON COLUMN public.pomodoro_sessions.session_status IS 'in_progress (active), completed (finished focus and break), or interrupted (stopped early).';

-- -----------------------------------------------------------------------------
-- 2. Indexes for Performance
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_started
    ON public.pomodoro_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_status
    ON public.pomodoro_sessions (user_id, session_status);

CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_subject
    ON public.pomodoro_sessions (subject_id)
    WHERE subject_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Automatic updated_at Trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_pomodoro_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pomodoro_sessions_updated_at ON public.pomodoro_sessions;

CREATE TRIGGER trigger_pomodoro_sessions_updated_at
    BEFORE UPDATE ON public.pomodoro_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_pomodoro_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Row Level Security (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;

-- Select policy: Users can only read their own sessions
DROP POLICY IF EXISTS "Users can read own pomodoro sessions" ON public.pomodoro_sessions;
CREATE POLICY "Users can read own pomodoro sessions"
    ON public.pomodoro_sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Insert policy: Users can only insert sessions for themselves
DROP POLICY IF EXISTS "Users can insert own pomodoro sessions" ON public.pomodoro_sessions;
CREATE POLICY "Users can insert own pomodoro sessions"
    ON public.pomodoro_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Update policy: Users can only update their own sessions
DROP POLICY IF EXISTS "Users can update own pomodoro sessions" ON public.pomodoro_sessions;
CREATE POLICY "Users can update own pomodoro sessions"
    ON public.pomodoro_sessions
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Delete policy: Users can only delete their own sessions
DROP POLICY IF EXISTS "Users can delete own pomodoro sessions" ON public.pomodoro_sessions;
CREATE POLICY "Users can delete own pomodoro sessions"
    ON public.pomodoro_sessions
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. Role Permissions
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pomodoro_sessions TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
