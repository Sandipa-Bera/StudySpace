export type PomodoroPhase = 'focus' | 'short_break' | 'long_break';

export type PomodoroTimerStatus = 'idle' | 'running' | 'paused' | 'alarm';

export type PomodoroSessionStatus = 'in_progress' | 'completed' | 'interrupted';

export interface PomodoroSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  planned_focus_seconds: number;
  planned_break_seconds: number;
  actual_focus_seconds: number;
  actual_break_seconds: number;
  session_status: PomodoroSessionStatus;
  current_phase: PomodoroPhase | 'completed';
  cycle_number: number;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  subject?: { id: string; name: string } | null;
  chapter?: { id: string; name: string } | null;
  topic?: { id: string; name: string } | null;
}

export interface PomodoroSettings {
  focusDurationMinutes: number;
  shortBreakDurationMinutes: number;
  longBreakDurationMinutes: number;
  longBreakInterval: number;
  alarmVolume: number; // 0 - 100
  browserNotifications: boolean;
  autoTransition: boolean;
}

export interface PomodoroLocalState {
  sessionId: string | null;
  phase: PomodoroPhase;
  status: PomodoroTimerStatus;
  cycleNumber: number;
  phaseStartTime: number | null;
  phaseEndTime: number | null;
  plannedDurationSeconds: number;
  remainingSeconds: number;
  accumulatedFocusSeconds: number;
  accumulatedBreakSeconds: number;
  currentRunStartTimestamp: number | null;
  subjectId: string | null;
  chapterId: string | null;
  topicId: string | null;
  lastActiveTimestamp: number;
}

export interface PomodoroStats {
  todayFocusSeconds: number;
  todayBreakSeconds: number;
  completedSessionsToday: number;
  weekFocusSeconds: number;
  weekBreakSeconds: number;
  totalFocusSeconds: number;
  totalBreakSeconds: number;
  totalCompletedSessions: number;
  currentStreak: number;
}

export interface DailyProductivity {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Mon", "Tue"
  focusSeconds: number;
  breakSeconds: number;
  completedSessions: number;
}
