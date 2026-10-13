/**
 * pomodoro.service.ts
 * ─────────────────────────────────────────────────────────────
 * Service layer for Pomodoro sessions, local state persistence,
 * Supabase synchronization, and analytics calculation.
 */

import { supabase } from '../lib/supabase';
import type {
  PomodoroSession,
  PomodoroSettings,
  PomodoroLocalState,
  PomodoroStats,
  DailyProductivity,
} from '../types/pomodoro.types';

const STORAGE_KEY_SETTINGS = 'studyspace_pomodoro_settings_v1';
const STORAGE_KEY_STATE = 'studyspace_pomodoro_state_v1';
const STORAGE_KEY_OFFLINE_QUEUE = 'studyspace_pomodoro_offline_queue_v1';

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusDurationMinutes: 25,
  shortBreakDurationMinutes: 5,
  longBreakDurationMinutes: 15,
  longBreakInterval: 4,
  alarmVolume: 70,
  browserNotifications: true,
  autoTransition: false,
};

// ─── Local Date Helpers (User Timezone Resilient) ─────────────

export function getLocalMidnight(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function getLocalTodayStartISO(): string {
  return getLocalMidnight().toISOString();
}

export function getLocalWeekStartISO(): string {
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
  return monday.toISOString();
}

export function formatDurationToHuman(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  if (safeSeconds === 0) return '0m';

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

// ─── Service Object ───────────────────────────────────────────

export const pomodoroService = {
  // ─── 1. Settings Persistence ────────────────────────────────
  getSettings(): PomodoroSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse pomodoro settings from localStorage:', e);
    }
    return DEFAULT_SETTINGS;
  },

  saveSettings(settings: PomodoroSettings): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save pomodoro settings to localStorage:', e);
    }
  },

  // ─── 2. Local Active State Persistence ──────────────────────
  getLocalState(): PomodoroLocalState | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STATE);
      if (!raw) return null;
      return JSON.parse(raw) as PomodoroLocalState;
    } catch (e) {
      console.warn('Failed to load local pomodoro state:', e);
      return null;
    }
  },

  saveLocalState(state: PomodoroLocalState): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save local pomodoro state:', e);
    }
  },

  clearLocalState(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY_STATE);
    } catch (e) {
      console.warn('Failed to clear local pomodoro state:', e);
    }
  },

  // ─── 3. Database Operations (pomodoro_sessions) ─────────────

  /**
   * Start a new Pomodoro session in Supabase.
   * Resilient to network failures (does not block local timer).
   */
  async startSession(
    userId: string,
    params: {
      plannedFocusSeconds: number;
      plannedBreakSeconds: number;
      cycleNumber: number;
      subjectId?: string | null;
      chapterId?: string | null;
      topicId?: string | null;
    }
  ): Promise<PomodoroSession | null> {
    const payload = {
      user_id: userId,
      started_at: new Date().toISOString(),
      planned_focus_seconds: params.plannedFocusSeconds,
      planned_break_seconds: params.plannedBreakSeconds,
      actual_focus_seconds: 0,
      actual_break_seconds: 0,
      session_status: 'in_progress',
      current_phase: 'focus',
      cycle_number: params.cycleNumber,
      subject_id: params.subjectId || null,
      chapter_id: params.chapterId || null,
      topic_id: params.topicId || null,
    };

    try {
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data as PomodoroSession;
    } catch (err) {
      console.warn('Supabase startSession failed (will continue locally):', err);
      // Queue offline payload if needed
      return null;
    }
  },

  /**
   * Checkpoint an active session (e.g. on phase change, pause, or resume).
   */
  async checkpointSession(
    sessionId: string,
    updates: {
      current_phase?: 'focus' | 'short_break' | 'long_break' | 'completed';
      actual_focus_seconds?: number;
      actual_break_seconds?: number;
      planned_break_seconds?: number;
      session_status?: 'in_progress' | 'completed' | 'interrupted';
      ended_at?: string | null;
    }
  ): Promise<void> {
    if (!sessionId) return;

    try {
      const { error } = await supabase
        .from('pomodoro_sessions')
        .update(updates)
        .eq('id', sessionId);

      if (error) throw error;
    } catch (err) {
      console.warn('Failed to checkpoint pomodoro session:', err);
    }
  },

  /**
   * Complete a session (both focus and break or completed cycle).
   */
  async completeSession(
    sessionId: string,
    actualFocusSeconds: number,
    actualBreakSeconds: number,
    metadata?: {
      userId?: string;
      subjectId?: string | null;
      chapterId?: string | null;
      topicId?: string | null;
    }
  ): Promise<void> {
    if (!sessionId) return;

    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('pomodoro_sessions')
        .update({
          session_status: 'completed',
          current_phase: 'completed',
          ended_at: now,
          actual_focus_seconds: actualFocusSeconds,
          actual_break_seconds: actualBreakSeconds,
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Also record in legacy focus_sessions table so existing FocusGarden continues to thrive
      if (metadata?.userId && actualFocusSeconds >= 60) {
        try {
          await supabase.from('focus_sessions').insert({
            user_id: metadata.userId,
            started_at: now,
            completed_at: now,
            status: 'completed',
            duration_seconds: actualFocusSeconds,
            subject_id: metadata.subjectId || null,
            chapter_id: metadata.chapterId || null,
            topic_id: metadata.topicId || null,
          });
        } catch {
          // Ignore legacy table errors if it has strict constraint
        }
      }
    } catch (err) {
      console.warn('Failed to complete pomodoro session in Supabase:', err);
    }
  },

  /**
   * Interrupt a session early (preserves actual focus & break time so no effort is lost).
   */
  async interruptSession(
    sessionId: string,
    actualFocusSeconds: number,
    actualBreakSeconds: number,
    metadata?: {
      userId?: string;
      subjectId?: string | null;
      chapterId?: string | null;
      topicId?: string | null;
    }
  ): Promise<void> {
    if (!sessionId) return;

    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('pomodoro_sessions')
        .update({
          session_status: 'interrupted',
          ended_at: now,
          actual_focus_seconds: actualFocusSeconds,
          actual_break_seconds: actualBreakSeconds,
        })
        .eq('id', sessionId);

      if (error) throw error;

      // If user did significant focus (>2 min), also credit it to FocusGarden
      if (metadata?.userId && actualFocusSeconds >= 120) {
        try {
          await supabase.from('focus_sessions').insert({
            user_id: metadata.userId,
            started_at: now,
            completed_at: now,
            status: 'completed',
            duration_seconds: actualFocusSeconds,
            subject_id: metadata.subjectId || null,
            chapter_id: metadata.chapterId || null,
            topic_id: metadata.topicId || null,
          });
        } catch {
          // Best effort
        }
      }
    } catch (err) {
      console.warn('Failed to mark session as interrupted:', err);
    }
  },

  /**
   * Delete a session record
   */
  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('pomodoro_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
  },

  // ─── 4. Query Sessions & Statistics ─────────────────────────

  /**
   * Fetch recent sessions with optional filter ('today' | 'week' | 'all')
   */
  async getSessions(
    userId: string,
    filter: 'today' | 'week' | 'all' = 'today',
    limit = 50
  ): Promise<PomodoroSession[]> {
    let query = supabase
      .from('pomodoro_sessions')
      .select(`
        *,
        subject:subjects(id, name),
        chapter:chapters(id, name),
        topic:topics(id, name)
      `)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (filter === 'today') {
      query = query.gte('started_at', getLocalTodayStartISO());
    } else if (filter === 'week') {
      query = query.gte('started_at', getLocalWeekStartISO());
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as PomodoroSession[];
  },

  /**
   * Aggregated metrics for productivity dashboard
   */
  async getStats(userId: string): Promise<PomodoroStats> {
    const todayStart = getLocalTodayStartISO();
    const weekStart = getLocalWeekStartISO();

    // Query all sessions for this user (only completed or interrupted with positive time)
    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .select('started_at, actual_focus_seconds, actual_break_seconds, session_status')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (error) {
      console.warn('Failed to fetch pomodoro sessions for stats:', error);
      return {
        todayFocusSeconds: 0,
        todayBreakSeconds: 0,
        completedSessionsToday: 0,
        weekFocusSeconds: 0,
        weekBreakSeconds: 0,
        totalFocusSeconds: 0,
        totalBreakSeconds: 0,
        totalCompletedSessions: 0,
        currentStreak: 0,
      };
    }

    const rows = (data || []) as Array<{
      started_at: string;
      actual_focus_seconds: number;
      actual_break_seconds: number;
      session_status: string;
    }>;

    let todayFocus = 0;
    let todayBreak = 0;
    let completedToday = 0;
    let weekFocus = 0;
    let weekBreak = 0;
    let totalFocus = 0;
    let totalBreak = 0;
    let totalCompleted = 0;

    const datesWithCompletedSession = new Set<string>();

    for (const row of rows) {
      const focus = Number(row.actual_focus_seconds || 0);
      const brk = Number(row.actual_break_seconds || 0);
      const isCompleted = row.session_status === 'completed';
      const at = row.started_at;

      totalFocus += focus;
      totalBreak += brk;
      if (isCompleted) {
        totalCompleted++;
        // Track local date for streak
        const localDateStr = new Date(at).toLocaleDateString('en-CA');
        datesWithCompletedSession.add(localDateStr);
      }

      if (at >= todayStart) {
        todayFocus += focus;
        todayBreak += brk;
        if (isCompleted) {
          completedToday++;
        }
      }

      if (at >= weekStart) {
        weekFocus += focus;
        weekBreak += brk;
      }
    }

    // ── Streak calculation ────────────────────────────────────
    let currentStreak = 0;
    const now = new Date();
    let checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // If today has no sessions yet, check if yesterday had one so streak isn't immediately 0
    const todayStr = checkDate.toLocaleDateString('en-CA');
    if (!datesWithCompletedSession.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dStr = checkDate.toLocaleDateString('en-CA');
      if (datesWithCompletedSession.has(dStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      todayFocusSeconds: todayFocus,
      todayBreakSeconds: todayBreak,
      completedSessionsToday: completedToday,
      weekFocusSeconds: weekFocus,
      weekBreakSeconds: weekBreak,
      totalFocusSeconds: totalFocus,
      totalBreakSeconds: totalBreak,
      totalCompletedSessions: totalCompleted,
      currentStreak,
    };
  },

  /**
   * Daily focus & break distribution for bar chart (last 7 days)
   */
  async getDailyProductivity(userId: string, days = 7): Promise<DailyProductivity[]> {
    const result: DailyProductivity[] = [];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const now = new Date();
    const map = new Map<string, { focus: number; break: number; count: number }>();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toLocaleDateString('en-CA');
      map.set(dateStr, { focus: 0, break: 0, count: 0 });
    }

    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1), 0, 0, 0, 0);

    try {
      const { data } = await supabase
        .from('pomodoro_sessions')
        .select('started_at, actual_focus_seconds, actual_break_seconds, session_status')
        .eq('user_id', userId)
        .gte('started_at', startDate.toISOString());

      if (data) {
        for (const row of data) {
          const dateStr = new Date(row.started_at).toLocaleDateString('en-CA');
          const entry = map.get(dateStr);
          if (entry) {
            entry.focus += Number(row.actual_focus_seconds || 0);
            entry.break += Number(row.actual_break_seconds || 0);
            if (row.session_status === 'completed') {
              entry.count++;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed to get daily productivity data:', err);
    }

    for (const [dateStr, values] of map.entries()) {
      const parts = dateStr.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      result.push({
        date: dateStr,
        dayLabel: dayLabels[d.getDay()],
        focusSeconds: values.focus,
        breakSeconds: values.break,
        completedSessions: values.count,
      });
    }

    return result;
  },
};
