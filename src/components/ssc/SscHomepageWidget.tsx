import { useNavigate } from 'react-router-dom';
import { useSscData } from '../../context/SscDataContext';
import { useAuth } from '../../hooks/useAuth';
import { sscStudyTasksService } from '../../services/ssc/sscStudyTasks.service';
import { useEffect, useState } from 'react';
import { Trophy, RefreshCw, AlertTriangle, ChevronRight, CheckCircle } from 'lucide-react';
import type { SscStudyTask } from '../../types/ssc.types';

export function SscHomepageWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { dashboardStats, loading } = useSscData();
  const [todayTasks, setTodayTasks] = useState<SscStudyTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    sscStudyTasksService
      .getToday(user.id)
      .then(setTodayTasks)
      .catch(console.error)
      .finally(() => setTasksLoading(false));
  }, [user]);

  if (loading || !dashboardStats) {
    return (
      <div className="card ssc-widget-skeleton">
        <div className="ssc-widget-skeleton-bar" style={{ width: '40%' }} />
        <div className="ssc-widget-skeleton-bar" style={{ width: '70%', height: 8 }} />
      </div>
    );
  }

  const {
    total_chapters, completed, in_progress, not_started, revise, overdue, completion_pct,
  } = (() => {
    const s = dashboardStats;
    const pct = s.total_chapters > 0
      ? Math.round((s.completed / s.total_chapters) * 100)
      : 0;
    return { ...s, completion_pct: pct };
  })();

  const todayDone  = todayTasks.filter((t) => t.is_completed).length;
  const todayTotal = todayTasks.length;

  return (
    <div className="card ssc-widget" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Decorative top accent */}
      <div className="ssc-widget-accent-bar" />

      {/* Header */}
      <div className="ssc-widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Trophy size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>SSC CGL Preparation</div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
              {total_chapters} chapters across 4 subjects
            </div>
          </div>
        </div>
        {overdue > 0 && (
          <span
            className="ssc-badge ssc-badge-red"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/ssc/revision')}
            title="View overdue revisions"
          >
            <AlertTriangle size={10} /> {overdue} overdue
          </span>
        )}
      </div>

      {/* Chapter counts */}
      <div className="ssc-widget-counts">
        <button
          className="ssc-widget-count-item"
          onClick={() => navigate('/ssc/syllabus?status=completed')}
          title="View completed chapters"
        >
          <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '1.1rem' }}>{completed}</span>
          <span>Completed</span>
        </button>
        <button
          className="ssc-widget-count-item"
          onClick={() => navigate('/ssc/syllabus?status=in_progress')}
          title="View chapters in progress"
        >
          <span style={{ color: 'var(--secondary)', fontWeight: 700, fontSize: '1.1rem' }}>{in_progress}</span>
          <span>In Progress</span>
        </button>
        <button
          className="ssc-widget-count-item"
          onClick={() => navigate('/ssc/syllabus?status=not_started')}
          title="View unstarted chapters"
        >
          <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '1.1rem' }}>{not_started}</span>
          <span>Not Started</span>
        </button>
        <button
          className="ssc-widget-count-item"
          onClick={() => navigate('/ssc/revision')}
          title="View revision due chapters"
        >
          <span style={{ color: 'var(--warning)', fontWeight: 700, fontSize: '1.1rem' }}>{revise}</span>
          <span>Revise</span>
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Syllabus Progress</span>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--accent)' }}>{completion_pct}%</span>
        </div>
        <div className="progress-track" style={{ height: 7 }}>
          <div
            className="progress-fill"
            style={{
              width: `${completion_pct}%`,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
      </div>

      {/* Today's tasks summary */}
      {!tasksLoading && (
        <div className="ssc-widget-tasks">
          <CheckCircle size={13} style={{ color: todayDone === todayTotal && todayTotal > 0 ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: 1 }}>
            {todayTotal === 0
              ? "No tasks planned for today"
              : `Today's Tasks: ${todayDone} of ${todayTotal} completed`}
          </span>
          {todayTotal > 0 && (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: todayDone === todayTotal ? 'var(--success)' : 'var(--warning)' }}>
              {Math.round((todayDone / todayTotal) * 100)}%
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary ssc-btn-sm"
          style={{ flex: 1, minWidth: 120 }}
          onClick={() => navigate('/ssc')}
        >
          <Trophy size={13} /> Continue Prep
        </button>
        <button
          className="btn btn-ghost ssc-btn-sm"
          onClick={() => navigate('/ssc')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
        >
          Full Dashboard <ChevronRight size={13} />
        </button>
        {overdue > 0 && (
          <button
            className="btn ssc-btn-sm"
            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.25)' }}
            onClick={() => navigate('/ssc/revision')}
          >
            <RefreshCw size={13} /> {overdue} Overdue
          </button>
        )}
      </div>
    </div>
  );
}
