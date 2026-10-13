import { useCallback, useEffect, useState } from 'react';
import {
  Clock,
  Coffee,
  CheckCircle2,
  Calendar,
  Flame,
  Filter,
  Trash2,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type {
  PomodoroSession,
  PomodoroStats,
  DailyProductivity,
} from '../../types/pomodoro.types';
import {
  pomodoroService,
  formatDurationToHuman,
} from '../../services/pomodoro.service';

interface PomodoroHistoryProps {
  userId: string;
  refreshTrigger: number;
  onRefreshStats?: () => void;
}

export function PomodoroHistory({
  userId,
  refreshTrigger,
  onRefreshStats,
}: PomodoroHistoryProps) {
  const [filter, setFilter] = useState<'today' | 'week' | 'all'>('today');
  const [stats, setStats] = useState<PomodoroStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyProductivity[]>([]);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const [fetchedStats, fetchedDaily, fetchedSessions] = await Promise.all([
        pomodoroService.getStats(userId),
        pomodoroService.getDailyProductivity(userId, 7),
        pomodoroService.getSessions(userId, filter, 40),
      ]);

      setStats(fetchedStats);
      setDailyData(fetchedDaily);
      setSessions(fetchedSessions);
      if (onRefreshStats) onRefreshStats();
    } catch (err: unknown) {
      console.error('Failed to load Pomodoro productivity data:', err);
      setError('Unable to load history from Supabase. Working in offline mode.');
    } finally {
      setLoading(false);
    }
  }, [userId, filter, onRefreshStats]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to remove this session from your productivity log?')) {
      return;
    }

    try {
      setDeletingId(sessionId);
      await pomodoroService.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      const newStats = await pomodoroService.getStats(userId);
      setStats(newStats);
      const newDaily = await pomodoroService.getDailyProductivity(userId, 7);
      setDailyData(newDaily);
    } catch (err) {
      console.error('Failed to delete session:', err);
      alert('Could not delete session. Please check your network connection.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatSessionTime = (isoString: string) => {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  // Find max seconds for bar chart scaling
  const maxBarSeconds = Math.max(
    ...dailyData.map((d) => Math.max(d.focusSeconds, d.breakSeconds)),
    1800 // min 30m baseline
  );

  return (
    <div className="pomo-history-section">
      {/* ── Metric Cards ── */}
      <div className="pomo-stats-grid">
        <div className="pomo-stat-card pomo-card-focus">
          <div className="pomo-stat-icon-wrap">
            <Clock className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="pomo-stat-content">
            <span className="pomo-stat-value">
              {formatDurationToHuman(stats?.todayFocusSeconds || 0)}
            </span>
            <span className="pomo-stat-label">Focus Today</span>
          </div>
        </div>

        <div className="pomo-stat-card pomo-card-break">
          <div className="pomo-stat-icon-wrap">
            <Coffee className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="pomo-stat-content">
            <span className="pomo-stat-value">
              {formatDurationToHuman(stats?.todayBreakSeconds || 0)}
            </span>
            <span className="pomo-stat-label">Break Today</span>
          </div>
        </div>

        <div className="pomo-stat-card pomo-card-cycles">
          <div className="pomo-stat-icon-wrap">
            <CheckCircle2 className="w-5 h-5 text-amber-500" />
          </div>
          <div className="pomo-stat-content">
            <span className="pomo-stat-value">
              {stats?.completedSessionsToday || 0}
            </span>
            <span className="pomo-stat-label">Cycles Today</span>
          </div>
        </div>

        <div className="pomo-stat-card pomo-card-week">
          <div className="pomo-stat-icon-wrap">
            <Calendar className="w-5 h-5 text-violet-500" />
          </div>
          <div className="pomo-stat-content">
            <span className="pomo-stat-value">
              {formatDurationToHuman(stats?.weekFocusSeconds || 0)}
            </span>
            <span className="pomo-stat-label">This Week</span>
          </div>
        </div>

        <div className="pomo-stat-card pomo-card-streak">
          <div className="pomo-stat-icon-wrap">
            <Flame className="w-5 h-5 text-rose-500" />
          </div>
          <div className="pomo-stat-content">
            <span className="pomo-stat-value">
              {stats?.currentStreak || 0} {stats?.currentStreak === 1 ? 'day' : 'days'}
            </span>
            <span className="pomo-stat-label">Focus Streak</span>
          </div>
        </div>
      </div>

      {/* ── Daily Activity Chart ── */}
      <div className="pomo-chart-card">
        <div className="pomo-chart-header">
          <div>
            <h3 className="pomo-chart-title">
              <TrendingUp className="w-4 h-4 inline mr-1 text-primary" /> Daily Activity (Last 7 Days)
            </h3>
            <p className="pomo-chart-subtitle">
              Calculated from actual completed session timestamps in your local timezone
            </p>
          </div>
          <div className="pomo-chart-legend">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
              <span>Focus</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
              <span>Break</span>
            </div>
          </div>
        </div>

        <div className="pomo-bars-container" role="img" aria-label="7-day focus and break activity comparison chart">
          {dailyData.map((day) => {
            const focusHeightPercent = Math.min(100, (day.focusSeconds / maxBarSeconds) * 100);
            const breakHeightPercent = Math.min(100, (day.breakSeconds / maxBarSeconds) * 100);

            return (
              <div key={day.date} className="pomo-bar-col">
                <div
                  className="pomo-bar-track"
                  title={`${day.date}: Focus ${formatDurationToHuman(day.focusSeconds)}, Break ${formatDurationToHuman(day.breakSeconds)}`}
                >
                  {/* Focus bar */}
                  <div
                    className="pomo-bar pomo-bar-focus"
                    style={{ height: `${Math.max(4, focusHeightPercent)}%` }}
                  />
                  {/* Break bar */}
                  <div
                    className="pomo-bar pomo-bar-break"
                    style={{ height: `${Math.max(4, breakHeightPercent)}%` }}
                  />
                </div>
                <div className="pomo-bar-day">{day.dayLabel}</div>
                <div className="pomo-bar-minutes">
                  {Math.round(day.focusSeconds / 60)}m
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent Sessions Table / List ── */}
      <div className="pomo-sessions-card">
        <div className="pomo-sessions-header">
          <div className="flex items-center gap-2">
            <h3 className="pomo-sessions-title">Session History</h3>
            <button
              onClick={loadData}
              className="pomo-icon-btn text-text-muted hover:text-primary transition-colors"
              title="Refresh history"
              disabled={loading}
              aria-label="Refresh session history"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="pomo-filter-pills" role="tablist" aria-label="Session history time filter">
            <Filter className="w-3.5 h-3.5 text-text-muted mr-1 hidden sm:inline" />
            <button
              role="tab"
              aria-selected={filter === 'today'}
              className={`pomo-filter-btn ${filter === 'today' ? 'active' : ''}`}
              onClick={() => setFilter('today')}
            >
              Today
            </button>
            <button
              role="tab"
              aria-selected={filter === 'week'}
              className={`pomo-filter-btn ${filter === 'week' ? 'active' : ''}`}
              onClick={() => setFilter('week')}
            >
              This Week
            </button>
            <button
              role="tab"
              aria-selected={filter === 'all'}
              className={`pomo-filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Loading state skeleton */}
        {loading && sessions.length === 0 && (
          <div className="pomo-skeleton-wrap">
            <div className="pomo-skeleton-row" />
            <div className="pomo-skeleton-row" />
            <div className="pomo-skeleton-row" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="pomo-error-banner" role="alert">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={loadData} className="ml-auto underline font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && sessions.length === 0 && (
          <div className="pomo-empty-state">
            <Sparkles className="w-10 h-10 text-primary mx-auto mb-2 opacity-60" />
            <h4 className="font-semibold text-text">No sessions recorded yet</h4>
            <p className="text-sm text-text-muted max-w-sm mx-auto mt-1">
              {filter === 'today'
                ? 'Start a focus timer above. When you complete or pause your session, your active study time will be recorded here automatically.'
                : 'No Pomodoro records found in this time range.'}
            </p>
          </div>
        )}

        {/* Sessions List */}
        {!loading && sessions.length > 0 && (
          <div className="pomo-sessions-list">
            {sessions.map((session) => {
              const isCompleted = session.session_status === 'completed';
              const isInterrupted = session.session_status === 'interrupted';
              const isInProgress = session.session_status === 'in_progress';

              const subjectTitle = session.subject?.name;
              const chapterTitle = session.chapter?.name;
              const topicTitle = session.topic?.name;

              return (
                <div key={session.id} className="pomo-session-row">
                  <div className="pomo-row-left">
                    <div className="pomo-row-time">
                      {formatSessionTime(session.started_at)}
                    </div>
                    <div className="pomo-row-meta">
                      <span className="pomo-cycle-badge">
                        Cycle #{session.cycle_number}
                      </span>
                      {(subjectTitle || topicTitle) && (
                        <span className="pomo-topic-badge">
                          {subjectTitle}
                          {topicTitle && ` · ${topicTitle}`}
                          {!topicTitle && chapterTitle && ` · ${chapterTitle}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pomo-row-center">
                    <div className="pomo-dur-stat">
                      <span className="text-text-muted text-xs">Focus:</span>
                      <strong>
                        {formatDurationToHuman(session.actual_focus_seconds)}
                      </strong>
                      <span className="text-xs text-text-muted font-normal">
                        ({Math.round(session.planned_focus_seconds / 60)}m planned)
                      </span>
                    </div>

                    {session.actual_break_seconds > 0 && (
                      <div className="pomo-dur-stat">
                        <span className="text-text-muted text-xs">Break:</span>
                        <strong>
                          {formatDurationToHuman(session.actual_break_seconds)}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div className="pomo-row-right">
                    {isCompleted && (
                      <span className="pomo-status-pill status-completed">
                        Completed
                      </span>
                    )}
                    {isInterrupted && (
                      <span className="pomo-status-pill status-interrupted">
                        Interrupted
                      </span>
                    )}
                    {isInProgress && (
                      <span className="pomo-status-pill status-in-progress">
                        Active
                      </span>
                    )}

                    <button
                      className="pomo-row-delete-btn"
                      onClick={() => handleDeleteSession(session.id)}
                      disabled={deletingId === session.id}
                      title="Delete record"
                      aria-label="Delete session record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
