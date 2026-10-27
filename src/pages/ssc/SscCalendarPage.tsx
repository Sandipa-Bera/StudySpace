import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { sscStudyTasksService } from '../../services/ssc/sscStudyTasks.service';
import { sscChaptersService } from '../../services/ssc/sscChapters.service';
import { sscSubjectsService } from '../../services/ssc/sscSubjects.service';
import { SscNav } from '../../components/ssc/SscNav';
import { LoadingState } from '../../components/ui/LoadingState';
import type { SscStudyTask, SscChapter, SscSubject } from '../../types/ssc.types';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isToday, isSameDay, parseISO, addMonths, subMonths,
} from 'date-fns';

export function SscCalendarPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<SscStudyTask[]>([]);
  const [chapters, setChapters] = useState<SscChapter[]>([]);
  const [subjects, setSubjects] = useState<SscSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
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
      } catch { showToast('Failed to load calendar', 'error'); }
      finally { setLoading(false); }
    })();
  }, [user, currentMonth]);

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

  const handleComplete = async (taskId: string) => {
    if (!user) return;
    try {
      await sscStudyTasksService.complete(taskId);
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, is_completed: true } : t));
    } catch { showToast('Failed to update task', 'error'); }
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
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <button className="btn btn-ghost ssc-btn-sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
            <ChevronLeft size={14} />
          </button>
          <button className="btn btn-ghost ssc-btn-sm" onClick={() => setCurrentMonth(new Date())}>Today</button>
          <button className="btn btn-ghost ssc-btn-sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
            <ChevronRight size={14} />
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
          const completedCount = dayTasks.filter((t) => t.is_completed).length;

          return (
            <button
              key={dateStr}
              className={[
                'ssc-cal-cell',
                isToday(day) ? 'today' : '',
                isSelected ? 'selected' : '',
                dayTasks.length > 0 ? 'has-tasks' : '',
              ].join(' ')}
              onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
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
          <h3 className="ssc-card-title">
            {format(selectedDay, 'EEEE, d MMMM')} — {selectedDayTasks.length} task{selectedDayTasks.length !== 1 ? 's' : ''}
          </h3>
          {selectedDayTasks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No tasks planned for this day.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedDayTasks.map((task) => {
                const chapter = task.chapter_id ? chapterMap.get(task.chapter_id) : null;
                const subject = chapter ? subjectMap.get(chapter.subject_id) : null;
                return (
                  <div key={task.id} className={`ssc-task-item${task.is_completed ? ' completed' : ''}`}>
                    <button
                      className={`ssc-task-check${task.is_completed ? ' done' : ''}`}
                      onClick={() => !task.is_completed && handleComplete(task.id)}
                      disabled={task.is_completed}
                    >
                      {task.is_completed ? <CheckCircle size={16} /> : <div className="ssc-task-circle" />}
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{task.title}</div>
                      {(subject || chapter) && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {subject?.name}{chapter && ` · ${chapter.name}`}
                        </div>
                      )}
                    </div>
                    <span className={`ssc-badge ssc-type-${task.task_type}`}>{task.task_type}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
