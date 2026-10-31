import { supabase } from '../lib/supabase';
import type { FocusTask, FocusTaskForm, DailyStudySummary } from '../types/focusTask.types';

const STORAGE_PREFIX = 'studyspace_focus_tasks_v1_';

function getLocalTasks(userId: string): FocusTask[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[FocusTaskService] Failed to read from localStorage:', err);
    return [];
  }
}

function setLocalTasks(userId: string, tasks: FocusTask[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(tasks));
  } catch (err) {
    console.warn('[FocusTaskService] Failed to write to localStorage:', err);
  }
}

export const focusTaskService = {
  /**
   * Get all tasks for a specific date (YYYY-MM-DD).
   */
  async getTasksByDate(userId: string, date: string): Promise<FocusTask[]> {
    const local = getLocalTasks(userId).filter((t) => t.date === date);

    try {
      const { data, error } = await supabase
        .from('focus_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .order('created_at', { ascending: true });

      if (!error && data) {
        // Merge with local storage
        const allLocal = getLocalTasks(userId);
        const otherDates = allLocal.filter((t) => t.date !== date);
        setLocalTasks(userId, [...otherDates, ...(data as FocusTask[])]);
        return data as FocusTask[];
      }
    } catch (err) {
      console.warn('[FocusTaskService] Supabase fetch failed, using local cache:', err);
    }

    return local;
  },

  /**
   * Get all distinct dates with study task records for history.
   */
  async getAllDatesWithTasks(userId: string): Promise<string[]> {
    const localDates = Array.from(new Set(getLocalTasks(userId).map((t) => t.date)));

    try {
      const { data, error } = await supabase
        .from('focus_tasks')
        .select('date')
        .eq('user_id', userId);

      if (!error && data) {
        const dbDates = (data as { date: string }[]).map((d) => d.date);
        const combined = Array.from(new Set([...localDates, ...dbDates])).sort().reverse();
        return combined;
      }
    } catch {
      // offline fallback
    }

    return localDates.sort().reverse();
  },

  /**
   * Create a new study task.
   */
  async createTask(userId: string, form: FocusTaskForm): Promise<FocusTask> {
    const newTask: FocusTask = {
      id: crypto.randomUUID ? crypto.randomUUID() : `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      user_id: userId,
      task_name: form.task_name,
      category: form.category || null,
      planned_duration_minutes: form.planned_duration_minutes,
      actual_duration_seconds: form.actual_duration_seconds || 0,
      status: form.status || 'pending',
      date: form.date,
      start_time: null,
      completion_time: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save locally first
    const all = getLocalTasks(userId);
    setLocalTasks(userId, [newTask, ...all]);

    try {
      const { data, error } = await supabase
        .from('focus_tasks')
        .insert({
          id: newTask.id,
          user_id: newTask.user_id,
          task_name: newTask.task_name,
          category: newTask.category,
          planned_duration_minutes: newTask.planned_duration_minutes,
          actual_duration_seconds: newTask.actual_duration_seconds,
          status: newTask.status,
          date: newTask.date,
          start_time: newTask.start_time,
          completion_time: newTask.completion_time,
        })
        .select()
        .single();

      if (!error && data) {
        return data as FocusTask;
      }
    } catch (err) {
      console.warn('[FocusTaskService] Supabase insert failed, stored in localStorage:', err);
    }

    return newTask;
  },

  /**
   * Update an existing study task.
   */
  async updateTask(userId: string, taskId: string, updates: Partial<FocusTask>): Promise<FocusTask> {
    const all = getLocalTasks(userId);
    const existingIndex = all.findIndex((t) => t.id === taskId);
    if (existingIndex === -1) {
      throw new Error('Task not found');
    }

    const updated: FocusTask = {
      ...all[existingIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    all[existingIndex] = updated;
    setLocalTasks(userId, all);

    try {
      const { data, error } = await supabase
        .from('focus_tasks')
        .update({
          task_name: updated.task_name,
          category: updated.category,
          planned_duration_minutes: updated.planned_duration_minutes,
          actual_duration_seconds: updated.actual_duration_seconds,
          status: updated.status,
          date: updated.date,
          start_time: updated.start_time,
          completion_time: updated.completion_time,
          updated_at: updated.updated_at,
        })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();

      if (!error && data) {
        return data as FocusTask;
      }
    } catch (err) {
      console.warn('[FocusTaskService] Supabase update failed, saved locally:', err);
    }

    return updated;
  },

  /**
   * Delete a task.
   */
  async deleteTask(userId: string, taskId: string): Promise<void> {
    const all = getLocalTasks(userId).filter((t) => t.id !== taskId);
    setLocalTasks(userId, all);

    try {
      await supabase
        .from('focus_tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId);
    } catch (err) {
      console.warn('[FocusTaskService] Supabase delete failed:', err);
    }
  },

  /**
   * Record progress for a task (increments actual seconds, starts timer, or marks completed).
   */
  async recordProgress(
    userId: string,
    taskId: string,
    addedSeconds: number,
    isCompleted: boolean = false
  ): Promise<FocusTask> {
    const all = getLocalTasks(userId);
    const task = all.find((t) => t.id === taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const nextActualSeconds = task.actual_duration_seconds + addedSeconds;
    const nowIso = new Date().toISOString();

    const updates: Partial<FocusTask> = {
      actual_duration_seconds: nextActualSeconds,
      updated_at: nowIso,
    };

    if (!task.start_time) {
      updates.start_time = nowIso;
    }

    if (isCompleted) {
      updates.status = 'completed';
      updates.completion_time = nowIso;
    } else if (task.status === 'pending' && nextActualSeconds > 0) {
      updates.status = 'in_progress';
    }

    return this.updateTask(userId, taskId, updates);
  },

  /**
   * Calculate daily summary metrics.
   */
  getDailySummary(tasks: FocusTask[], date: string): DailyStudySummary {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const remainingTasks = totalTasks - completedTasks;
    const totalPlannedMinutes = tasks.reduce((sum, t) => sum + (t.planned_duration_minutes || 0), 0);
    const totalActualSeconds = tasks.reduce((sum, t) => sum + (t.actual_duration_seconds || 0), 0);

    const plannedSeconds = totalPlannedMinutes * 60;
    const completionRatePct = plannedSeconds > 0
      ? Math.min(100, Math.round((totalActualSeconds / plannedSeconds) * 100))
      : 0;

    return {
      date,
      totalTasks,
      completedTasks,
      remainingTasks,
      totalPlannedMinutes,
      totalActualSeconds,
      completionRatePct,
    };
  },
};

// ─── Human Formatting Utilities ───────────────────────────────────

/** Formats minutes into e.g. "3 hours 30 minutes", "1 hour", or "45 minutes" */
export function formatMinutesHuman(minutes: number): string {
  const safeMins = Math.max(0, Math.round(minutes));
  if (safeMins === 0) return '0 minutes';

  const h = Math.floor(safeMins / 60);
  const m = safeMins % 60;

  if (h > 0 && m > 0) return `${h} hour${h > 1 ? 's' : ''} ${m} minute${m > 1 ? 's' : ''}`;
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''}`;
  return `${m} minute${m > 1 ? 's' : ''}`;
}

/** Formats seconds into e.g. "2 hours 45 minutes" or "30 minutes" */
export function formatSecondsHuman(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60);
  return formatMinutesHuman(mins);
}

/** Formats seconds into digital timer display "MM:SS" or "HH:MM:SS" */
export function formatTimerCountdown(totalSecs: number): string {
  const safe = Math.max(0, Math.floor(totalSecs));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

