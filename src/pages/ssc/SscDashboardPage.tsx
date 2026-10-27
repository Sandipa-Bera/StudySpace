import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useSscData } from '../../context/SscDataContext';
import { sscSubjectsService } from '../../services/ssc/sscSubjects.service';
import { sscChaptersService } from '../../services/ssc/sscChapters.service';
import { sscProgressService } from '../../services/ssc/sscProgress.service';
import { sscStudyTasksService } from '../../services/ssc/sscStudyTasks.service';
import { SscNav } from '../../components/ssc/SscNav';
import { StatusBadge, StatChip } from '../../components/ssc/SscBadges';
import { LoadingState } from '../../components/ui/LoadingState';
import { SscTaskModal } from '../../components/ssc/SscTaskModal';
import { ConfirmDialog } from '../../components/ssc/SscModal';
import type {
  SscSubject,
  SscChapter,
  SscChapterProgress,
  SscStudyTask,
  SscSubjectStats,
  DashboardStats,
} from '../../types/ssc.types';
import {
  Trophy,
  BookOpen,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Target,
  Plus,
  ChevronRight,
  Flame,
  Clock,
  TrendingUp,
  Edit2,
  Trash2,
} from 'lucide-react';
import { format, isToday, parseISO, isBefore } from 'date-fns';

export function SscDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refresh: refreshContext } = useSscData();

  const [subjects, setSubjects] = useState<SscSubject[]>([]);
  const [chapters, setChapters] = useState<SscChapter[]>([]);
  const [progress, setProgress] = useState<SscChapterProgress[]>([]);
  const [todayTasks, setTodayTasks] = useState<SscStudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Task modal & delete confirmation states
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<SscStudyTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<SscStudyTask | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [subs, chs, prog, tasks] = await Promise.all([
        sscSubjectsService.getAll(),
        sscChaptersService.getAll(),
        sscProgressService.getAllForUser(user.id),
        sscStudyTasksService.getToday(user.id),
      ]);
      setSubjects(subs);
      setChapters(chs);
      setProgress(prog);
      setTodayTasks(tasks);
      setStats(computeStats(subs, chs, prog));
    } catch (err) {
      console.error(err);
      showToast('Failed to load SSC dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleToggleTask = async (task: SscStudyTask) => {
    if (!user) return;
    try {
      if (task.is_completed) {
        const updated = await sscStudyTasksService.uncomplete(task.id);
        setTodayTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
        showToast('Task marked incomplete', 'info');
      } else {
        const updated = await sscStudyTasksService.complete(task.id);
        setTodayTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
        showToast('Task marked complete!', 'success');
      }
      refreshContext();
    } catch {
      showToast('Failed to update task', 'error');
    }
  };

  const handleOpenAddTask = () => {
    setTaskToEdit(null);
    setTaskModalOpen(true);
  };

  const handleOpenEditTask = (task: SscStudyTask) => {
    setTaskToEdit(task);
    setTaskModalOpen(true);
  };

  const handleTaskSaved = (savedTask: SscStudyTask) => {
    setTodayTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === savedTask.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedTask;
        return next;
      }
      return [...prev, savedTask];
    });
    showToast(taskToEdit ? 'Task updated!' : 'Task created!', 'success');
    refreshContext();
  };

  const confirmDeleteTask = async () => {
    if (!deletingTask) return;
    try {
      await sscStudyTasksService.delete(deletingTask.id);
      setTodayTasks((prev) => prev.filter((t) => t.id !== deletingTask.id));
      setDeletingTask(null);
      showToast('Task deleted', 'success');
      refreshContext();
    } catch {
      showToast('Failed to delete task', 'error');
    }
  };

  if (loading) return <LoadingState message="Loading SSC dashboard…" />;

  const today = format(new Date(), 'EEEE, d MMMM yyyy');

  return (
    <div className="ssc-page" style={{ animation: 'fadeIn 0.2s ease' }}>
      {/* ── Page header ── */}
      <div className="ssc-page-header">
        <div className="ssc-page-header-left">
          <Trophy size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>SSC CGL Prep</h1>
            <p className="page-subtitle">{today}</p>
          </div>
        </div>
      </div>

      <SscNav />

      {/* ── Setup prompt if no data ── */}
      {subjects.length === 0 ? (
        <div className="ssc-empty-setup card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <Trophy size={48} style={{ color: 'var(--accent)', marginBottom: '1rem', opacity: 0.6 }} />
          <h2 style={{ margin: '0 0 0.5rem' }}>Syllabus not loaded yet</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: 420, margin: '0 auto 1.5rem' }}>
            Run the SQL migration in your Supabase dashboard to seed the 4 subjects and 66 chapters,
            then refresh this page.
          </p>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Open Supabase Dashboard
          </a>
        </div>
      ) : (
        <>
          {/* ── Overall stat chips ── */}
          {stats && (
            <section className="ssc-section">
              <div className="ssc-stats-grid">
                <StatChip label="Subjects"     value={stats.total_subjects} />
                <StatChip label="Chapters"     value={stats.total_chapters} />
                <StatChip label="Completed"    value={stats.completed}   color="var(--success)" />
                <StatChip label="In Progress"  value={stats.in_progress} color="var(--secondary)" />
                <StatChip label="Not Started"  value={stats.not_started} color="var(--text-muted)" />
                <StatChip label="Need Revision" value={stats.revise}     color="var(--warning)" />
                <StatChip label="Overdue"      value={stats.overdue}     color="var(--error)" />
                <StatChip label="Weak"         value={stats.weak}        color="var(--error)" />
                <StatChip
                  label="Accuracy"
                  value={stats.overall_accuracy > 0 ? `${stats.overall_accuracy}%` : '—'}
                  color={stats.overall_accuracy >= 80 ? 'var(--success)' : stats.overall_accuracy >= 60 ? 'var(--warning)' : 'var(--text-muted)'}
                />
                <StatChip
                  label="Attempted"
                  value={stats.total_attempted.toLocaleString()}
                  sub="questions"
                />
              </div>
            </section>
          )}

          {/* ── Overall progress bar ── */}
          {stats && stats.total_chapters > 0 && (
            <section className="ssc-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Overall Completion</span>
                <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'Lora, serif' }}>
                  {Math.round((stats.completed / stats.total_chapters) * 100)}%
                </span>
              </div>
              <div className="progress-track" style={{ height: 8 }}>
                <div
                  className="progress-fill"
                  style={{ width: `${Math.round((stats.completed / stats.total_chapters) * 100)}%` }}
                />
              </div>
              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                {stats.completed} of {stats.total_chapters} chapters completed
              </p>
            </section>
          )}

          {/* ── Subject cards ── */}
          {stats && (
            <section className="ssc-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="ssc-section-title">Subjects</h2>
                <button className="btn btn-ghost ssc-btn-sm" onClick={() => navigate('/ssc/syllabus')}>
                  View All <ChevronRight size={14} />
                </button>
              </div>
              <div className="ssc-subject-grid">
                {stats.subject_stats.map((ss) => (
                  <SubjectCard
                    key={ss.subject.id}
                    ss={ss}
                    onClick={() => navigate(`/ssc/syllabus/${ss.subject.slug}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Today's Study Plan ── */}
          <section className="ssc-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="ssc-section-title">
                <Flame size={16} style={{ color: 'var(--warning)' }} />
                Today's Study Plan
              </h2>
              <button className="btn btn-primary ssc-btn-sm" onClick={handleOpenAddTask}>
                <Plus size={14} /> Add task
              </button>
            </div>

            {todayTasks.length === 0 ? (
              <div className="ssc-empty-card">
                <Clock size={24} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No tasks planned for today.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {stats && stats.overdue > 0 && (
                    <button className="btn btn-secondary ssc-btn-sm" onClick={() => navigate('/ssc/revision')}>
                      <AlertTriangle size={13} /> {stats.overdue} overdue revision{stats.overdue !== 1 ? 's' : ''}
                    </button>
                  )}
                  {stats && stats.not_started > 0 && (
                    <button className="btn btn-secondary ssc-btn-sm" onClick={() => navigate('/ssc/priority')}>
                      <Target size={13} /> Start a chapter
                    </button>
                  )}
                  <button className="btn btn-ghost ssc-btn-sm" onClick={handleOpenAddTask}>
                    <Plus size={13} /> Add custom task
                  </button>
                </div>
              </div>
            ) : (
              <div className="ssc-task-list">
                {todayTasks.map((task) => {
                  const chapter = chapters.find((c) => c.id === task.chapter_id);
                  const subject = chapter ? subjects.find((s) => s.id === chapter.subject_id) : null;
                  return (
                    <div
                      key={task.id}
                      className={`ssc-task-item${task.is_completed ? ' completed' : ''}`}
                    >
                      <button
                        className={`ssc-task-check${task.is_completed ? ' done' : ''}`}
                        onClick={() => handleToggleTask(task)}
                        aria-label={task.is_completed ? 'Mark incomplete' : 'Mark complete'}
                        title={task.is_completed ? 'Click to mark incomplete' : 'Click to mark complete'}
                      >
                        {task.is_completed ? <CheckCircle size={18} /> : <div className="ssc-task-circle" />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          color: task.is_completed ? 'var(--text-muted)' : 'var(--text)',
                          textDecoration: task.is_completed ? 'line-through' : undefined,
                        }}>
                          {task.title}
                        </div>
                        {(subject || chapter || task.reason) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            {subject?.name && <span>{subject.name}</span>}
                            {chapter?.name && <span> · {chapter.name}</span>}
                            {task.reason && <span style={{ fontStyle: 'italic' }}> · {task.reason}</span>}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        {task.estimated_minutes && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {task.estimated_minutes}m
                          </span>
                        )}
                        <span className={`ssc-badge ssc-task-type-badge ssc-type-${task.task_type}`}>
                          {task.task_type}
                        </span>

                        {/* Task Edit & Delete Actions */}
                        <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.25rem' }}>
                          <button
                            className="btn btn-ghost ssc-btn-sm"
                            style={{ padding: '0.25rem 0.4rem', height: 'auto' }}
                            onClick={() => handleOpenEditTask(task)}
                            title="Edit task"
                            aria-label="Edit task"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="btn btn-ghost ssc-btn-sm"
                            style={{ padding: '0.25rem 0.4rem', height: 'auto', color: 'var(--error)' }}
                            onClick={() => setDeletingTask(task)}
                            title="Delete task"
                            aria-label="Delete task"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                    {todayTasks.filter((t) => t.is_completed).length}/{todayTasks.length} done
                  </span>
                  <button className="btn btn-ghost ssc-btn-sm" onClick={handleOpenAddTask}>
                    <Plus size={13} /> Add task
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── Quick links ── */}
          <section className="ssc-section">
            <h2 className="ssc-section-title">Quick Actions</h2>
            <div className="ssc-quick-grid">
              {[
                { label: 'Revision Centre',  icon: RefreshCw,    to: '/ssc/revision',   color: 'var(--warning)',   count: stats?.revise ?? 0, badge: stats?.overdue ? `${stats.overdue} overdue` : null },
                { label: 'Priority Board',   icon: Target,       to: '/ssc/priority',   color: 'var(--accent)' },
                { label: 'Log Practice',     icon: TrendingUp,   to: '/ssc/practice',   color: 'var(--secondary)' },
                { label: 'Mock Tests',       icon: Trophy,       to: '/ssc/mock-tests', color: 'var(--success)' },
              ].map(({ label, icon: Icon, to, color, badge }) => (
                <button
                  key={to}
                  className="ssc-quick-card card card-hover"
                  onClick={() => navigate(to)}
                >
                  <Icon size={20} style={{ color }} />
                  <span>{label}</span>
                  {badge && <span className="ssc-badge ssc-badge-red">{badge}</span>}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Task Modal for Add/Edit */}
      {user && (
        <SscTaskModal
          isOpen={taskModalOpen}
          onClose={() => setTaskModalOpen(false)}
          userId={user.id}
          taskToEdit={taskToEdit}
          subjects={subjects}
          chapters={chapters}
          onSaved={handleTaskSaved}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingTask)}
        onCancel={() => setDeletingTask(null)}
        onConfirm={confirmDeleteTask}
        title="Delete Study Task"
        message={`Are you sure you want to delete "${deletingTask?.title}"? This task will disappear from your schedule and task counts. (Your chapter study history and practice records will NOT be deleted.)`}
        confirmLabel="Delete Task"
        danger
      />
    </div>
  );
}

// ── Subject card component ──────────────────────────────────

function SubjectCard({
  ss,
  onClick,
}: {
  ss: SscSubjectStats;
  onClick: () => void;
}) {
  const pct = ss.completion_pct;

  const SUBJECT_COLORS: Record<string, string> = {
    reasoning:        'var(--accent)',
    'general-studies': 'var(--success)',
    quantitative:     'var(--secondary)',
    english:          'var(--warning)',
  };
  const color = SUBJECT_COLORS[ss.subject.slug] ?? 'var(--accent)';

  return (
    <div
      className="ssc-subject-card card card-hover"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`Open ${ss.subject.name} syllabus`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text)' }}>
            {ss.subject.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            {ss.total_chapters} chapters
          </div>
        </div>
        <span style={{ fontSize: '1.375rem', fontWeight: 700, color, fontFamily: 'Lora, serif' }}>
          {pct}%
        </span>
      </div>

      <div className="progress-track" style={{ height: 6, marginBottom: '0.75rem' }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>

      <div className="ssc-subject-mini-stats">
        <span style={{ color: 'var(--success)' }}>✓ {ss.completed}</span>
        <span style={{ color: 'var(--secondary)' }}>◑ {ss.in_progress}</span>
        <span style={{ color: 'var(--text-muted)' }}>○ {ss.not_started}</span>
        {ss.revise > 0 && <span style={{ color: 'var(--warning)' }}>↺ {ss.revise}</span>}
        {ss.overdue > 0 && <span style={{ color: 'var(--error)' }}>⚠ {ss.overdue} overdue</span>}
      </div>

      {ss.accuracy > 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Accuracy: <strong style={{ color: ss.accuracy >= 80 ? 'var(--success)' : ss.accuracy >= 60 ? 'var(--warning)' : 'var(--error)' }}>{ss.accuracy}%</strong>
        </div>
      )}

      <div style={{ textAlign: 'right', marginTop: '0.75rem' }}>
        <span style={{ fontSize: '0.75rem', color: color }}>View Syllabus →</span>
      </div>
    </div>
  );
}

// ── Stats computation ───────────────────────────────────────

function computeStats(
  subjects: SscSubject[],
  chapters: SscChapter[],
  progress: SscChapterProgress[]
): DashboardStats {
  const progressMap = new Map(progress.map((p) => [p.chapter_id, p]));
  const today = new Date();

  let totalAttempted = 0;
  let totalCorrect = 0;

  const subject_stats: SscSubjectStats[] = subjects.map((sub) => {
    const subChapters = chapters.filter((c) => c.subject_id === sub.id);
    let notStarted = 0, inProgress = 0, completed = 0, revise = 0, weak = 0, overdue = 0;
    let subAttempted = 0, subCorrect = 0;

    for (const ch of subChapters) {
      const p = progressMap.get(ch.id);
      const status = p?.status ?? 'not_started';
      if (status === 'not_started') notStarted++;
      else if (status === 'in_progress') inProgress++;
      else if (status === 'completed') completed++;
      else if (status === 'revise') revise++;

      if (p?.is_weak) weak++;
      if (p?.next_revision_at && isBefore(parseISO(p.next_revision_at), today)) overdue++;

      subAttempted += p?.questions_attempted ?? 0;
      subCorrect   += p?.questions_correct ?? 0;
    }

    totalAttempted += subAttempted;
    totalCorrect   += subCorrect;

    const completion_pct = subChapters.length > 0
      ? Math.round((completed / subChapters.length) * 100)
      : 0;
    const accuracy = subAttempted > 0 ? Math.round((subCorrect / subAttempted) * 100) : 0;

    return {
      subject: sub,
      total_chapters: subChapters.length,
      not_started: notStarted,
      in_progress: inProgress,
      completed,
      revise,
      weak,
      overdue,
      completion_pct,
      accuracy,
      questions_attempted: subAttempted,
    };
  });

  const totals = subject_stats.reduce(
    (acc, ss) => ({
      not_started: acc.not_started + ss.not_started,
      in_progress: acc.in_progress + ss.in_progress,
      completed:   acc.completed   + ss.completed,
      revise:      acc.revise      + ss.revise,
      weak:        acc.weak        + ss.weak,
      overdue:     acc.overdue     + ss.overdue,
    }),
    { not_started: 0, in_progress: 0, completed: 0, revise: 0, weak: 0, overdue: 0 }
  );

  return {
    total_subjects: subjects.length,
    total_chapters: chapters.length,
    overall_accuracy: totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0,
    total_attempted: totalAttempted,
    subject_stats,
    ...totals,
  };
}
