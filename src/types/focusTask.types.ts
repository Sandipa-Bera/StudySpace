// ─── Focus Task & Timer Types ─────────────────────────────────────

export type FocusTaskStatus = 'pending' | 'in_progress' | 'completed';

export interface FocusTask {
  id: string;
  user_id: string;
  task_name: string;
  category: string | null;
  planned_duration_minutes: number;
  actual_duration_seconds: number;
  status: FocusTaskStatus;
  date: string; // YYYY-MM-DD
  start_time: string | null; // ISO timestamp
  completion_time: string | null; // ISO timestamp
  created_at: string;
  updated_at: string;
}

export interface FocusTaskForm {
  task_name: string;
  category?: string | null;
  planned_duration_minutes: number;
  date: string;
  status?: FocusTaskStatus;
  actual_duration_seconds?: number;
}

export interface DailyStudySummary {
  date: string;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  totalPlannedMinutes: number;
  totalActualSeconds: number;
  completionRatePct: number;
}

export interface FocusTimerSessionState {
  taskId: string | null;
  status: 'idle' | 'running' | 'paused' | 'completed';
  remainingSeconds: number;
  totalPlannedSeconds: number;
  accumulatedSeconds: number;
  lastTickTimestamp: number | null;
}

