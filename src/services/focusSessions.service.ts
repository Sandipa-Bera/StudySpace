/**
 * focusSessions.service.ts
 * ─────────────────────────────────────────────────────────
 * Service layer for the Focus Garden feature.
 *
 * KEY DESIGN DECISIONS:
 * - getFocusStats() queries the table DIRECTLY (no RPC dependency)
 *   so it works even before/if the RPC functions exist in Supabase.
 * - completeSession() updates via direct UPDATE (not RPC) with
 *   duration computed from started_at stored at session start time.
 * - Timezone: all date comparisons use the user's LOCAL date
 *   (derived from browser timezone offset) to avoid midnight-UTC bugs.
 */

import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────

export interface FocusSession {
  id: string;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  duration_seconds: number | null;
  status: 'in_progress' | 'completed' | 'cancelled';
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
}

export interface FocusStats {
  total_sessions: number;
  total_seconds: number;
  today_sessions: number;
  today_seconds: number;
  yesterday_seconds: number;
  this_week_seconds: number;
  current_streak: number;
}

// ─── Time helpers ─────────────────────────────────────────

/** Format seconds into "Xh Ym" or "Ym" or "0m" display string */
export function formatFocusTime(seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  if (totalMinutes === 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Get today's start in LOCAL time as an ISO string.
 * This ensures "today" means the user's calendar day, not UTC.
 */
function getLocalTodayStart(): string {
  const now = new Date();
  const localMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0, 0, 0, 0
  );
  return localMidnight.toISOString();
}

/**
 * Get "this week" start (Monday 00:00 local time) as ISO string.
 */
function getLocalWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysToMonday,
    0, 0, 0, 0
  );
  return monday.toISOString();
}

/**
 * Get yesterday's start (local) as ISO string.
 */
function getLocalYesterdayStart(): string {
  const now = new Date();
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
    0, 0, 0, 0
  );
  return yesterday.toISOString();
}

// ─── Service ──────────────────────────────────────────────

export const focusSessionsService = {

  /**
   * Start a new focus session.
   * Records the exact start time in the DB.
   * If there's already an in-progress session (e.g. from a crash),
   * cancel it first, then start fresh.
   */
  async startSession(
    userId: string,
    options?: {
      subjectId?: string;
      chapterId?: string;
      topicId?: string;
    }
  ): Promise<FocusSession> {
    // Cancel any stale in-progress sessions first (prevents unique index conflict)
    await supabase
      .from('focus_sessions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('status', 'in_progress');

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('focus_sessions')
      .insert({
        user_id: userId,
        started_at: now,
        status: 'in_progress',
        subject_id: options?.subjectId || null,
        chapter_id: options?.chapterId || null,
        topic_id: options?.topicId || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as FocusSession;
  },

  /**
   * Complete a focus session.
   * Calculates duration from the session's stored started_at to now.
   * Ensures planned duration is respected so 1m sessions record at least 60s.
   * Uses direct UPDATE with RPC support.
   * Idempotent: if already completed, returns existing row.
   */
  async completeSession(sessionId: string, plannedDurationSeconds?: number): Promise<FocusSession> {
    // Fetch the session to get started_at
    const { data: session, error: fetchErr } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!session) throw new Error('Session not found');

    // Idempotent: already completed, return as-is
    if (session.status === 'completed') {
      return session as FocusSession;
    }

    if (session.status === 'cancelled') {
      throw new Error('Cannot complete a cancelled session');
    }

    const now = new Date();
    const startedAt = new Date(session.started_at);
    const elapsedSeconds = Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 1000));
    const durationSeconds = Math.max(
      0,
      Math.min(
        Math.max(plannedDurationSeconds ?? 0, elapsedSeconds),
        28800 // cap at 8 hours
      )
    );

    const { data, error } = await supabase
      .from('focus_sessions')
      .update({
        status: 'completed',
        completed_at: now.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data as FocusSession;
  },

  /**
   * Cancel a focus session.
   * Idempotent — safe to call on an already-cancelled session.
   */
  async cancelSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('focus_sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId)
      .eq('status', 'in_progress'); // Only cancel if still in_progress

    if (error) throw error;
  },

  /**
   * Fetch aggregated focus stats for the authenticated user.
   * Works with or without passing userId explicitly.
   * Tries RPC get_focus_stats first, falls back to direct table query.
   * Uses LOCAL timezone for date boundaries.
   */
  async getFocusStats(userId?: string): Promise<FocusStats> {
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      targetUserId = user?.id;
    }

    if (!targetUserId) {
      return {
        total_sessions: 0,
        total_seconds: 0,
        today_sessions: 0,
        today_seconds: 0,
        yesterday_seconds: 0,
        this_week_seconds: 0,
        current_streak: 0,
      };
    }

    // Try RPC first
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_focus_stats');
      if (!rpcErr && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        const row = rpcData[0];
        return {
          total_sessions: Number(row.total_sessions || 0),
          total_seconds: Number(row.total_seconds || 0),
          today_sessions: Number(row.today_sessions || 0),
          today_seconds: Number(row.today_seconds || 0),
          yesterday_seconds: Number(row.yesterday_seconds || 0),
          this_week_seconds: Number(row.this_week_seconds || 0),
          current_streak: Number(row.current_streak || 0),
        };
      }
    } catch {
      // Fall through to direct table query
    }

    const todayStart = getLocalTodayStart();
    const yesterdayStart = getLocalYesterdayStart();
    const weekStart = getLocalWeekStart();

    // Fetch all completed sessions
    const { data: sessions, error } = await supabase
      .from('focus_sessions')
      .select('started_at, duration_seconds, status')
      .eq('user_id', targetUserId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false });

    if (error) throw error;

    const rows = (sessions ?? []) as Array<{
      started_at: string;
      duration_seconds: number | null;
    }>;

    let total_sessions = 0;
    let total_seconds = 0;
    let today_sessions = 0;
    let today_seconds = 0;
    let yesterday_seconds = 0;
    let this_week_seconds = 0;

    for (const row of rows) {
      const dur = row.duration_seconds ?? 0;
      const at = row.started_at;

      total_sessions++;
      total_seconds += dur;

      if (at >= todayStart) {
        today_sessions++;
        today_seconds += dur;
      } else if (at >= yesterdayStart) {
        yesterday_seconds += dur;
      }

      if (at >= weekStart) {
        this_week_seconds += dur;
      }
    }

    // ── Streak calculation ──────────────────────────────────
    // Walk backwards from today, counting consecutive days with ≥1 session
    let current_streak = 0;
    if (rows.length > 0) {
      // Build a Set of local date strings (YYYY-MM-DD) that had sessions
      const sessionDates = new Set<string>();
      for (const row of rows) {
        // Convert UTC timestamp to local date string
        const localDate = new Date(row.started_at).toLocaleDateString('en-CA'); // YYYY-MM-DD
        sessionDates.add(localDate);
      }

      const today = new Date();
      let checkDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

      while (true) {
        const dateStr = checkDate.toLocaleDateString('en-CA');
        if (!sessionDates.has(dateStr)) break;
        current_streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    return {
      total_sessions,
      total_seconds,
      today_sessions,
      today_seconds,
      yesterday_seconds,
      this_week_seconds,
      current_streak,
    };
  },

  /**
   * Find any in-progress session for a user.
   */
  async getInProgressSession(userId: string): Promise<FocusSession | null> {
    const { data, error } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as FocusSession | null;
  },
};
