import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useSscData } from '../../context/SscDataContext';
import { sscStudyTasksService } from '../../services/ssc/sscStudyTasks.service';
import { sscChaptersService } from '../../services/ssc/sscChapters.service';
import { sscSubjectsService } from '../../services/ssc/sscSubjects.service';
import { SscNav } from '../../components/ssc/SscNav';
import { LoadingState } from '../../components/ui/LoadingState';
import { SscTaskModal } from '../../components/ssc/SscTaskModal';
import { ConfirmDialog } from '../../components/ssc/SscModal';
import type { SscStudyTask, SscChapter, SscSubject } from '../../types/ssc.types';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle, Plus, Edit2, Trash2 } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isToday, isSameDay, parseISO, addMonths, subMonths,
} from 'date-fns';

export function SscCalendarPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { refresh: refreshContext } = useSscData();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<SscStudyTask[]>([]);
  const [chapters, setChapters] = useState<SscChapter[]>([]);
  const [subjects, setSubjects] = useState<SscSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  // Task modal & delete confirmation
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<SscStudyTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<SscStudyTask | null>(null);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end   = format(endOfMonth(currentMonth),   'yyyy-MM-dd');
      const [t, chs, subs] = await Promise.all([
        sscStudyTasksService.getRange(user.id, start, end),
        sscChaptersService.getAll(),
        sscSubjectsService.getAll(),
      ]);
      setTasks(t);
      setChapters(chs);
      setSubjects(subs);
    } catch {
      showToast('Failed to load calendar', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, currentMonth]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOffset = (startOfMonth(currentMonth).getDay() + 6) % 7; // Mon start

  const tasksByDate = useMemo(() => {
    const map: Record<string, SscStudyTask[]> = {};
    for (const t of tasks) {
      const key = t.planned_date;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [tasks]);

  const selectedDayTasks = selectedDay
    ? (tasksByDate[format(selectedDay, 'yyyy-MM-dd')] ?? [])
    : [];

  const handleToggleComplete = async (task: SscStudyTask) => {
    if (!user) return;
    try {
      if (task.is_completed) {
        const updated = await sscStudyTasksService.uncomplete(task.id);
        setTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
        showToast('Task marked incomplete', 'info');
      } else {
        const updated = await sscStudyTasksService.complete(task.id);
        setTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
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
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === savedTask.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedTask;
        return next;
      }
      return [...prev, savedTask];
    });
    showToast(taskToEdit ? 'Task updated!' : 'Task scheduled!', 'success');
    refreshContext();
  };

  const confirmDeleteTask = async () => {
    if (!deletingTask) return;
    try {
      await sscStudyTasksService.delete(deletingTask.id);
      setTasks((prev) => prev.filter((t) => t.id !== deletingTask.id));
      setDeletingTask(null);
      showToast('Task deleted', 'success');
      refreshContext();
    } catch {
      showToast('Failed to delete task', 'error');
    }
  };

  if (loading) return <LoadingState message="Loading calendar…" />;

  return (
    <div className="ssc-page" style={{ animation: 'fadeIn 0.2s ease' }}>
      <div className="ssc-page-header">
        <div className="ssc-page-header-left">
          <Calendar size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Study Calendar</h1>
            <p className="page-subtitle">{format(currentMonth, 'MMMM yyyy')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          <button className="btn btn-ghost ssc-btn-sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
            <ChevronLeft size={14} />
          </button>
          <button className="btn btn-ghost ssc-btn-sm" onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()); }}>
            Today
          </button>
          <button className="btn btn-ghost ssc-btn-sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
            <ChevronRight size={14} />
          </button>
          <button className="btn btn-primary ssc-btn-sm" onClick={handleOpenAddTask} style={{ marginLeft: '0.5rem' }}>
            <Plus size={14} /> Schedule Task
          </button>
        </div>
      </div>
      <SscNav />

      {/* Calendar grid */}
      <div className="ssc-calendar-grid">
        {/* Day headers */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="ssc-cal-header">{d}</div>
        ))}

        {/* Empty cells before first day */}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="ssc-cal-cell ssc-cal-cell-empty" />
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[dateStr] ?? [];
          const isSelected = selectedDay && isSameDay(day, selectedDay);

          return (
            <button
              key={dateStr}
              className={[
                'ssc-cal-cell',
                isToday(day) ? 'today' : '',
                isSelected ? 'selected' : '',
                dayTasks.length > 0 ? 'has-tasks' : '',
              ].join(' ')}
              onClick={() => setSelectedDay(day)}
            >
              <span className="ssc-cal-day-num">{format(day, 'd')}</span>
              {dayTasks.length > 0 && (
                <div className="ssc-cal-dots">
                  {dayTasks.slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      className={`ssc-cal-dot ssc-type-${t.task_type}${t.is_completed ? ' done' : ''}`}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>+{dayTasks.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day task list */}
      {selectedDay && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 className="ssc-card-title" style={{ margin: 0 }}>
              {format(selectedDay, 'EEEE, d MMMM yyyy')} — {selectedDayTasks.length} task{selectedDayTasks.length !== 1 ? 's' : ''}
            </h3>
            <button className="btn btn-primary ssc-btn-sm" onClick={handleOpenAddTask}>
              <Plus size={13} /> Add Task for this day
            </button>
          </div>

          {selectedDayTasks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              No tasks planned for this day. Click "+ Add Task for this day" to plan a session.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedDayTasks.map((task) => {
                const chapter = task.chapter_id ? chapterMap.get(task.chapter_id) : null;
                const subject = chapter ? subjectMap.get(chapter.subject_id) : null;
                return (
                  <div key={task.id} className={`ssc-task-item${task.is_completed ? ' completed' : ''}`}>
                    <button
                      className={`ssc-task-check${task.is_completed ? ' done' : ''}`}
                      onClick={() => handleToggleComplete(task)}
                      title={task.is_completed ? 'Click to mark incomplete' : 'Click to mark complete'}
                    >
                      {task.is_completed ? <CheckCircle size={16} /> : <div className="ssc-task-circle" />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        textDecoration: task.is_completed ? 'line-through' : undefined,
                        color: task.is_completed ? 'var(--text-muted)' : 'var(--text)',
                      }}>
                        {task.title}
                      </div>
                      {(subject || chapter || task.reason) && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {subject?.name}{chapter && ` · ${chapter.name}`}{task.reason && ` · ${task.reason}`}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      {task.estimated_minutes && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {task.estimated_minutes}m
                        </span>
                      )}
                      <span className={`ssc-badge ssc-type-${task.task_type}`}>{task.task_type}</span>

                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          className="btn btn-ghost ssc-btn-sm"
                          style={{ padding: '0.2rem 0.4rem' }}
                          onClick={() => handleOpenEditTask(task)}
                          title="Edit task"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="btn btn-ghost ssc-btn-sm"
                          style={{ padding: '0.2rem 0.4rem', color: 'var(--error)' }}
                          onClick={() => setDeletingTask(task)}
                          title="Delete task"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Task Modal */}
      {user && (
        <SscTaskModal
          isOpen={taskModalOpen}
          onClose={() => setTaskModalOpen(false)}
          userId={user.id}
          taskToEdit={taskToEdit}
          defaultDate={selectedDay ? format(selectedDay, 'yyyy-MM-dd') : undefined}
          subjects={subjects}
          chapters={chapters}
          onSaved={handleTaskSaved}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingTask)}
        onCancel={() => setDeletingTask(null)}
        onConfirm={confirmDeleteTask}
        title="Delete Study Task"
        message={`Are you sure you want to delete "${deletingTask?.title}" from your calendar? (Your chapter progress and practice records are unaffected.)`}
        confirmLabel="Delete Task"
        danger
      />
    </div>
  );
}
