import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { tasksService } from '../services/tasks.service';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { calcProgress } from '../utils/progress';
import {
  today,
  toLocalDateStr,
  getTodayTasks,
  getUpcomingTasks,
  getOverdueTasks,
  getCompletedTasks,
  getTasksForDate,
  getDailyCompletionRate,
  getConsistencyScore,
  getCurrentStreak,
  getLongestStreak,
  getYearProgress,
  getWeeklyData,
  getYearHeatmapData,
  getHeatmapLevel,
  getMonthTaskMap,
} from '../utils/taskAnalytics';
import { format, parseISO, getDay, startOfWeek, endOfWeek, addDays, eachDayOfInterval } from 'date-fns';
import {
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  Flame,
  TrendingUp,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  X,
  Filter,
  ArrowUpDown,
  Target,
  Zap,
  Award,
  ListTodo,
  CalendarDays,
  Repeat,
  AlertCircle,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────

const PRIORITY_CONFIG = {
  high: { label: 'High', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },
  medium: { label: 'Medium', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  low: { label: 'Low', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
};

const RECURRENCE_LABELS = {
  none: 'None',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const VIEWS = {
  TODAY: 'today',
  UPCOMING: 'upcoming',
  OVERDUE: 'overdue',
  COMPLETED: 'completed',
  ALL: 'all',
};

// ─── Main Page Component ────────────────────────────────────

export function TaskManagerPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [activeView, setActiveView] = useState(VIEWS.TODAY);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [selectedCalDate, setSelectedCalDate] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [sortBy, setSortBy] = useState('due_date');
  const [filterPriority, setFilterPriority] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeSection, setActiveSection] = useState('tasks'); // 'tasks' | 'analytics'

  // ─── Data Loading ───────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [taskData, completionData] = await Promise.all([
        tasksService.getAll(user.id),
        tasksService.getAllCompletions(user.id),
      ]);
      setTasks(taskData);
      setCompletions(completionData);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      showToast('Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Computed Data ──────────────────────────────────────

  const todayStr = today();

  const todayTasks = useMemo(
    () => getTodayTasks(tasks, completions),
    [tasks, completions]
  );
  const upcomingTasks = useMemo(
    () => getUpcomingTasks(tasks, completions),
    [tasks, completions]
  );
  const overdueTasks = useMemo(
    () => getOverdueTasks(tasks, completions),
    [tasks, completions]
  );
  const completedTasksList = useMemo(
    () => getCompletedTasks(tasks, completions),
    [tasks, completions]
  );

  const todayCompleted = todayTasks.filter((t) => t._isCompleted).length;
  const todayTotal = todayTasks.length;
  const todayPct = todayTotal > 0 ? calcProgress(todayCompleted, todayTotal) : null;

  const consistency = useMemo(
    () => getConsistencyScore(tasks, completions, 30),
    [tasks, completions]
  );
  const currentStreak = useMemo(
    () => getCurrentStreak(tasks, completions),
    [tasks, completions]
  );
  const longestStreak = useMemo(
    () => getLongestStreak(tasks, completions),
    [tasks, completions]
  );
  const yearProgress = useMemo(() => getYearProgress(), []);
  const weeklyData = useMemo(
    () => getWeeklyData(tasks, completions),
    [tasks, completions]
  );
  const heatmapData = useMemo(
    () => getYearHeatmapData(tasks, completions),
    [tasks, completions]
  );
  const calendarMap = useMemo(
    () => getMonthTaskMap(tasks, completions, calYear, calMonth),
    [tasks, completions, calYear, calMonth]
  );

  // ─── Current view tasks ────────────────────────────────

  const getViewTasks = () => {
    let list;
    switch (activeView) {
      case VIEWS.TODAY:
        list = todayTasks;
        break;
      case VIEWS.UPCOMING:
        list = upcomingTasks;
        break;
      case VIEWS.OVERDUE:
        list = overdueTasks;
        break;
      case VIEWS.COMPLETED:
        list = completedTasksList;
        break;
      case VIEWS.ALL:
      default:
        list = tasks.map((t) => ({
          ...t,
          _dateStr: t.due_date,
          _isCompleted: t.completed,
          _isRecurring: t.recurrence_type !== 'none',
        }));
    }

    // Apply priority filter
    if (filterPriority !== 'all') {
      list = list.filter((t) => t.priority === filterPriority);
    }

    // Sort
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'priority': {
          const order = { high: 0, medium: 1, low: 2 };
          return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
        }
        case 'created':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'due_date':
        default:
          return (a._dateStr || a.due_date).localeCompare(b._dateStr || b.due_date);
      }
    });
  };

  const viewTasks = getViewTasks();

  // ─── Task Actions ──────────────────────────────────────

  const handleToggleComplete = async (task) => {
    try {
      if (task._isRecurring) {
        const dateStr = task._dateStr || todayStr;
        if (task._isCompleted) {
          await tasksService.removeCompletion(task.id, dateStr);
        } else {
          await tasksService.addCompletion(task.id, dateStr);
        }
      } else {
        await tasksService.toggleComplete(task.id, !task._isCompleted);
      }
      await loadData();
    } catch (err) {
      console.error('Toggle failed:', err);
      showToast('Failed to update task', 'error');
    }
  };

  const handleSaveTask = async (form) => {
    try {
      if (editingTask) {
        await tasksService.update(editingTask.id, form);
        showToast('Task updated');
      } else {
        await tasksService.create(user.id, form);
        showToast('Task created');
      }
      setShowAddModal(false);
      setEditingTask(null);
      await loadData();
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Failed to save task', 'error');
    }
  };

  const handleDelete = async (mode) => {
    if (!deletingTask) return;
    try {
      if (mode === 'all' || !deletingTask._isRecurring) {
        await tasksService.delete(deletingTask.id);
      } else if (mode === 'future') {
        // Set recurrence end to the day before
        const endDate = toLocalDateStr(
          addDays(parseISO(deletingTask._dateStr || todayStr), -1)
        );
        await tasksService.update(deletingTask.id, {
          ...deletingTask,
          recurrence_end: endDate,
        });
        await tasksService.deleteFutureCompletions(
          deletingTask.id,
          deletingTask._dateStr || todayStr
        );
      }
      // mode === 'occurrence': just mark as completed or do nothing special
      // (we don't actually delete a virtual occurrence; the user can skip it)
      setDeletingTask(null);
      showToast('Task deleted');
      await loadData();
    } catch (err) {
      console.error('Delete failed:', err);
      showToast('Failed to delete task', 'error');
    }
  };

  // ─── Calendar Navigation ──────────────────────────────

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  // ─── Render ────────────────────────────────────────────

  if (loading) return <LoadingState message="Loading tasks…" />;

  const selectedDateTasks = selectedCalDate
    ? getTasksForDate(tasks, completions, selectedCalDate)
    : [];

  return (
    <div className="tm-page" style={{ animation: 'fadeIn 0.2s ease' }}>
      {/* ── Header ─────────────────────────────────── */}
      <div className="tm-header">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Task Manager
          </h1>
          <p className="page-subtitle">
            Create, schedule, and track your tasks
          </p>
        </div>
        <button
          className="btn btn-primary"
          id="add-task-btn"
          onClick={() => {
            setEditingTask(null);
            setShowAddModal(true);
          }}
        >
          <Plus size={15} />
          Add Task
        </button>
      </div>

      {/* ── Dashboard Summary Cards ───────────────── */}
      <div className="tm-summary-grid">
        <div className="card tm-summary-card">
          <ListTodo size={18} style={{ color: 'var(--secondary)' }} />
          <div className="tm-summary-value">
            {todayTotal > 0 ? `${todayCompleted} / ${todayTotal}` : '—'}
          </div>
          <div className="tm-summary-label">Today's Tasks</div>
        </div>
        <div className="card tm-summary-card">
          <Target size={18} style={{ color: 'var(--accent)' }} />
          <div className="tm-summary-value">
            {consistency.score !== null ? `${consistency.score}%` : '—'}
          </div>
          <div className="tm-summary-label">Consistency</div>
        </div>
        <div className="card tm-summary-card">
          <Flame size={18} style={{ color: '#EF4444' }} />
          <div className="tm-summary-value">
            {currentStreak > 0 ? `${currentStreak}d` : '—'}
          </div>
          <div className="tm-summary-label">Current Streak</div>
        </div>
        <div className="card tm-summary-card">
          <CalendarDays size={18} style={{ color: '#10B981' }} />
          <div className="tm-summary-value">
            {yearProgress.daysPassed}
          </div>
          <div className="tm-summary-label">
            / {yearProgress.totalDays} days ({yearProgress.daysRemaining} left)
          </div>
        </div>
      </div>

      {/* ── Section Toggle ────────────────────────── */}
      <div className="tm-section-toggle">
        <button
          className={`tm-section-btn${activeSection === 'tasks' ? ' active' : ''}`}
          onClick={() => setActiveSection('tasks')}
        >
          <ListTodo size={15} />
          Tasks
        </button>
        <button
          className={`tm-section-btn${activeSection === 'analytics' ? ' active' : ''}`}
          onClick={() => setActiveSection('analytics')}
        >
          <BarChart3 size={15} />
          Analytics
        </button>
      </div>

      {activeSection === 'tasks' ? (
        <TasksSection
          viewTasks={viewTasks}
          activeView={activeView}
          setActiveView={setActiveView}
          sortBy={sortBy}
          setSortBy={setSortBy}
          filterPriority={filterPriority}
          setFilterPriority={setFilterPriority}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          todayPct={todayPct}
          todayCompleted={todayCompleted}
          todayTotal={todayTotal}
          overdueTasks={overdueTasks}
          onToggle={handleToggleComplete}
          onEdit={(task) => {
            setEditingTask(task);
            setShowAddModal(true);
          }}
          onDelete={(task) => setDeletingTask(task)}
          calMonth={calMonth}
          calYear={calYear}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
          calendarMap={calendarMap}
          todayStr={todayStr}
          selectedCalDate={selectedCalDate}
          setSelectedCalDate={setSelectedCalDate}
          selectedDateTasks={selectedDateTasks}
        />
      ) : (
        <AnalyticsSection
          tasks={tasks}
          completions={completions}
          consistency={consistency}
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          yearProgress={yearProgress}
          weeklyData={weeklyData}
          heatmapData={heatmapData}
          todayPct={todayPct}
          todayCompleted={todayCompleted}
          todayTotal={todayTotal}
        />
      )}

      {/* ── Add/Edit Modal ────────────────────────── */}
      {showAddModal && (
        <TaskFormModal
          task={editingTask}
          onSave={handleSaveTask}
          onClose={() => {
            setShowAddModal(false);
            setEditingTask(null);
          }}
        />
      )}

      {/* ── Delete Confirmation ───────────────────── */}
      {deletingTask && (
        <DeleteConfirmModal
          task={deletingTask}
          onDelete={handleDelete}
          onClose={() => setDeletingTask(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── Tasks Section ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function TasksSection({
  viewTasks,
  activeView,
  setActiveView,
  sortBy,
  setSortBy,
  filterPriority,
  setFilterPriority,
  showFilters,
  setShowFilters,
  todayPct,
  todayCompleted,
  todayTotal,
  overdueTasks,
  onToggle,
  onEdit,
  onDelete,
  calMonth,
  calYear,
  prevMonth,
  nextMonth,
  calendarMap,
  todayStr,
  selectedCalDate,
  setSelectedCalDate,
  selectedDateTasks,
}) {
  return (
    <div className="tm-tasks-layout">
      <div className="tm-tasks-main">
        {/* Today's Progress */}
        {todayTotal > 0 && (
          <div className="card tm-today-progress">
            <div className="tm-today-progress-header">
              <span className="tm-today-progress-title">Today's Progress</span>
              <span className="tm-today-progress-pct">{todayPct}%</span>
            </div>
            <div className="progress-track" style={{ height: 8 }}>
              <div
                className={`progress-fill${todayPct === 100 ? ' complete' : ''}`}
                style={{ width: `${todayPct}%` }}
              />
            </div>
            <div className="tm-today-progress-sub">
              {todayCompleted} / {todayTotal} tasks completed
            </div>
          </div>
        )}

        {/* View Tabs */}
        <div className="tm-view-bar">
          <div className="tm-view-tabs">
            {[
              { key: VIEWS.TODAY, label: 'Today' },
              { key: VIEWS.UPCOMING, label: 'Upcoming' },
              { key: VIEWS.OVERDUE, label: `Overdue${overdueTasks.length ? ` (${overdueTasks.length})` : ''}` },
              { key: VIEWS.COMPLETED, label: 'Completed' },
              { key: VIEWS.ALL, label: 'All' },
            ].map((v) => (
              <button
                key={v.key}
                className={`tm-view-tab${activeView === v.key ? ' active' : ''}`}
                onClick={() => setActiveView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="tm-view-controls">
            <button
              className="btn-icon"
              title="Filter"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={15} />
            </button>
          </div>
        </div>

        {/* Filters / Sort */}
        {showFilters && (
          <div className="tm-filters card" style={{ animation: 'slideUp 0.15s ease' }}>
            <div className="tm-filter-group">
              <label className="form-label">Priority</label>
              <select
                className="form-select"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                <option value="all">All priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="tm-filter-group">
              <label className="form-label">Sort by</label>
              <select
                className="form-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="due_date">Due date</option>
                <option value="priority">Priority</option>
                <option value="created">Created</option>
              </select>
            </div>
          </div>
        )}

        {/* Task List */}
        {viewTasks.length === 0 ? (
          <EmptyState
            icon={activeView === VIEWS.TODAY ? '🎉' : '📋'}
            title={
              activeView === VIEWS.TODAY
                ? 'No tasks for today'
                : activeView === VIEWS.OVERDUE
                ? 'No overdue tasks'
                : activeView === VIEWS.COMPLETED
                ? 'No completed tasks yet'
                : 'No tasks found'
            }
            description={
              activeView === VIEWS.TODAY
                ? 'Your schedule is clear. Enjoy your day!'
                : activeView === VIEWS.OVERDUE
                ? "You're all caught up!"
                : 'Start by adding your first task.'
            }
          />
        ) : (
          <div className="tm-task-list">
            {viewTasks.map((task, idx) => (
              <TaskRow
                key={`${task.id}-${task._dateStr}-${idx}`}
                task={task}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                todayStr={todayStr}
              />
            ))}
          </div>
        )}
      </div>

      {/* Calendar Sidebar */}
      <div className="tm-calendar-sidebar">
        <CalendarWidget
          month={calMonth}
          year={calYear}
          onPrev={prevMonth}
          onNext={nextMonth}
          calendarMap={calendarMap}
          todayStr={todayStr}
          selectedDate={selectedCalDate}
          onSelectDate={setSelectedCalDate}
        />
        {selectedCalDate && (
          <div className="tm-cal-tasks">
            <h4 className="tm-cal-tasks-title">
              {format(parseISO(selectedCalDate), 'MMMM d, yyyy')}
            </h4>
            {selectedDateTasks.length === 0 ? (
              <p className="tm-cal-tasks-empty">No tasks on this day</p>
            ) : (
              selectedDateTasks.map((task, i) => (
                <div key={`${task.id}-${i}`} className="tm-cal-task-item">
                  <div
                    className={`tm-mini-check${task._isCompleted ? ' checked' : ''}`}
                    onClick={() => onToggle(task)}
                  >
                    {task._isCompleted && <CheckCircle2 size={12} color="#fff" />}
                  </div>
                  <span className={task._isCompleted ? 'tm-cal-task-done' : ''}>
                    {task.title}
                  </span>
                  <span
                    className="tm-priority-dot"
                    style={{ background: PRIORITY_CONFIG[task.priority]?.color }}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── Task Row ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function TaskRow({ task, onToggle, onEdit, onDelete, todayStr }) {
  const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const isOverdue =
    !task._isCompleted &&
    (task._dateStr || task.due_date) < todayStr &&
    task.recurrence_type === 'none';
  const dateLabel = getDateLabel(task._dateStr || task.due_date, todayStr);

  return (
    <div className={`tm-task-row${task._isCompleted ? ' completed' : ''}${isOverdue ? ' overdue' : ''}`}>
      <div
        className={`checkbox-wrap${task._isCompleted ? ' checked' : ''}`}
        onClick={() => onToggle(task)}
        role="checkbox"
        aria-checked={task._isCompleted}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle(task)}
      >
        {task._isCompleted && <CheckCircle2 size={12} color="#fff" />}
      </div>
      <div className="tm-task-content">
        <div className={`tm-task-title${task._isCompleted ? ' done' : ''}`}>
          {task.title}
        </div>
        <div className="tm-task-meta">
          {dateLabel && (
            <span className={`tm-task-date${isOverdue ? ' overdue' : ''}`}>
              <Calendar size={11} />
              {dateLabel}
            </span>
          )}
          {task.due_time && (
            <span className="tm-task-time">
              <Clock size={11} />
              {task.due_time.slice(0, 5)}
            </span>
          )}
          <span className="tm-task-priority" style={{ color: pri.color, background: pri.bg }}>
            {pri.label}
          </span>
          {task._isRecurring && (
            <span className="tm-task-recurrence">
              <Repeat size={11} />
              {RECURRENCE_LABELS[task.recurrence_type]}
            </span>
          )}
        </div>
        {task.description && (
          <div className="tm-task-desc">{task.description}</div>
        )}
      </div>
      <div className="tm-task-actions">
        <button className="btn-icon" title="Edit" onClick={() => onEdit(task)}>
          <Edit3 size={14} />
        </button>
        <button className="btn-icon" title="Delete" onClick={() => onDelete(task)}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function getDateLabel(dateStr, todayStr) {
  if (!dateStr) return '';
  if (dateStr === todayStr) return 'Today';
  const d = parseISO(dateStr);
  const t = parseISO(todayStr);
  const diff = Math.round((d - t) / 86400000);
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return format(d, 'MMM d');
}

// ═══════════════════════════════════════════════════════════
// ─── Calendar Widget ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function CalendarWidget({ month, year, onPrev, onNext, calendarMap, todayStr, selectedDate, onSelectDate }) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = getDay(firstDay); // 0=Sun
  const totalDays = lastDay.getDate();

  const cells = [];
  for (let i = 0; i < startDay; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push(d);
  }

  return (
    <div className="card tm-calendar">
      <div className="tm-cal-header">
        <button className="btn-icon" onClick={onPrev}>
          <ChevronLeft size={16} />
        </button>
        <span className="tm-cal-month">
          {format(firstDay, 'MMMM yyyy')}
        </span>
        <button className="btn-icon" onClick={onNext}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="tm-cal-grid">
        {DAY_NAMES_SHORT.map((d, i) => (
          <div key={i} className="tm-cal-day-label">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null)
            return <div key={`empty-${i}`} className="tm-cal-cell empty" />;

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const info = calendarMap[dateStr];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;

          return (
            <div
              key={dateStr}
              className={`tm-cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${info ? ' has-tasks' : ''}`}
              onClick={() => onSelectDate(dateStr === selectedDate ? null : dateStr)}
            >
              <span className="tm-cal-day-num">{day}</span>
              {info && (
                <div className="tm-cal-indicators">
                  {info.completed > 0 && info.completed === info.total ? (
                    <span className="tm-cal-dot done" />
                  ) : info.completed > 0 ? (
                    <span className="tm-cal-dot partial" />
                  ) : (
                    <span className="tm-cal-dot pending" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── Analytics Section ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

function AnalyticsSection({
  tasks,
  completions,
  consistency,
  currentStreak,
  longestStreak,
  yearProgress,
  weeklyData,
  heatmapData,
  todayPct,
  todayCompleted,
  todayTotal,
}) {
  const [hoveredHeatDay, setHoveredHeatDay] = useState(null);

  const hasData = tasks.length > 0;

  if (!hasData) {
    return (
      <EmptyState
        icon="📊"
        title="Not enough data yet"
        description="Complete some tasks to start building your consistency graph."
      />
    );
  }

  const maxBarRate = Math.max(...weeklyData.map((d) => d.rate ?? 0), 1);

  return (
    <div className="tm-analytics">
      {/* ── Today's Progress ──────────────────────── */}
      <div className="card tm-analytics-card">
        <h3 className="tm-analytics-title">Today's Progress</h3>
        {todayTotal > 0 ? (
          <>
            <div className="tm-big-pct">{todayPct}%</div>
            <div className="progress-track" style={{ height: 8, marginBottom: 8 }}>
              <div
                className={`progress-fill${todayPct === 100 ? ' complete' : ''}`}
                style={{ width: `${todayPct}%` }}
              />
            </div>
            <div className="tm-analytics-sub">
              {todayCompleted} / {todayTotal} tasks completed
            </div>
          </>
        ) : (
          <div className="tm-analytics-sub" style={{ marginTop: 8 }}>
            No tasks scheduled for today
          </div>
        )}
      </div>

      {/* ── Consistency + Streak Row ──────────────── */}
      <div className="tm-analytics-row">
        <div className="card tm-analytics-card">
          <h3 className="tm-analytics-title">Consistency</h3>
          <div className="tm-big-pct" style={{ color: 'var(--accent)' }}>
            {consistency.score !== null ? `${consistency.score}%` : '—'}
          </div>
          {consistency.score !== null && (
            <div className="tm-analytics-sub">
              Based on {consistency.scheduledDays} days with scheduled tasks (last {consistency.totalDays}d)
            </div>
          )}
        </div>
        <div className="card tm-analytics-card">
          <h3 className="tm-analytics-title">Streak</h3>
          <div className="tm-streak-row">
            <div>
              <div className="tm-big-pct" style={{ color: '#EF4444' }}>
                {currentStreak}
              </div>
              <div className="tm-analytics-sub">Current streak (days)</div>
            </div>
            <div className="tm-streak-divider" />
            <div>
              <div className="tm-big-pct" style={{ color: '#F59E0B', fontSize: '1.5rem' }}>
                {longestStreak}
              </div>
              <div className="tm-analytics-sub">Longest streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Weekly Bar Chart ─────────────────────── */}
      <div className="card tm-analytics-card">
        <h3 className="tm-analytics-title">This Week</h3>
        <div className="tm-weekly-chart">
          {weeklyData.map((d) => (
            <div key={d.date} className="tm-weekly-bar-col">
              <div className="tm-weekly-rate">
                {d.rate !== null ? `${d.rate}%` : ''}
              </div>
              <div className="tm-weekly-bar-track">
                <div
                  className={`tm-weekly-bar-fill${d.rate === 100 ? ' perfect' : ''}`}
                  style={{ height: d.rate !== null ? `${Math.max(d.rate, 4)}%` : '0%' }}
                />
              </div>
              <div className="tm-weekly-day">{d.dayName}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Year Progress ────────────────────────── */}
      <div className="card tm-analytics-card">
        <h3 className="tm-analytics-title">{yearProgress.year} Progress</h3>
        <div className="tm-year-progress-bar">
          <div className="progress-track" style={{ height: 10 }}>
            <div
              className="progress-fill"
              style={{
                width: `${calcProgress(yearProgress.daysPassed, yearProgress.totalDays)}%`,
                background: 'linear-gradient(90deg, var(--secondary), var(--accent))',
              }}
            />
          </div>
          <div className="tm-year-progress-labels">
            <span>{yearProgress.daysPassed} days completed</span>
            <span>{yearProgress.daysRemaining} days remaining</span>
          </div>
        </div>

        {/* Year dot grid */}
        <div className="tm-year-dots">
          {Array.from({ length: yearProgress.totalDays }, (_, i) => {
            const dayNum = i + 1;
            const isPast = dayNum < yearProgress.daysPassed;
            const isToday = dayNum === yearProgress.daysPassed;
            return (
              <span
                key={i}
                className={`tm-year-dot${isPast ? ' past' : ''}${isToday ? ' today' : ''}`}
              />
            );
          })}
        </div>
      </div>

      {/* ── Contribution Heatmap ─────────────────── */}
      <div className="card tm-analytics-card">
        <h3 className="tm-analytics-title">Yearly Consistency</h3>
        <div className="tm-heatmap-wrap">
          <div className="tm-heatmap">
            {heatmapData.map((d) => {
              const level = getHeatmapLevel(d.rate);
              return (
                <div
                  key={d.date}
                  className={`tm-heatmap-cell level-${level}`}
                  title={`${format(parseISO(d.date), 'MMM d')}: ${d.total > 0 ? `${d.completed}/${d.total} (${d.rate}%)` : 'No tasks'}`}
                  onMouseEnter={() => setHoveredHeatDay(d)}
                  onMouseLeave={() => setHoveredHeatDay(null)}
                />
              );
            })}
          </div>
          <div className="tm-heatmap-legend">
            <span className="tm-heatmap-legend-label">Less</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className={`tm-heatmap-cell level-${l}`} />
            ))}
            <span className="tm-heatmap-legend-label">More</span>
          </div>
          {hoveredHeatDay && hoveredHeatDay.total > 0 && (
            <div className="tm-heatmap-tooltip">
              <strong>{format(parseISO(hoveredHeatDay.date), 'MMMM d')}</strong>
              <br />
              Tasks: {hoveredHeatDay.total} · Completed: {hoveredHeatDay.completed} · {hoveredHeatDay.rate}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── Task Form Modal ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function TaskFormModal({ task, onSave, onClose }) {
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    due_date: task?.due_date || today(),
    due_time: task?.due_time?.slice(0, 5) || '',
    priority: task?.priority || 'medium',
    recurrence_type: task?.recurrence_type || 'none',
    recurrence_days: task?.recurrence_days || [],
    recurrence_end: task?.recurrence_end || '',
    recurrence_interval: task?.recurrence_interval || 1,
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Task name is required';
    if (!form.due_date) errs.due_date = 'Date is required';
    if (form.recurrence_type === 'weekly' && form.recurrence_days.length === 0) {
      errs.recurrence_days = 'Select at least one day';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      ...form,
      due_time: form.due_time || null,
      recurrence_end: form.recurrence_end || null,
    });
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      recurrence_days: prev.recurrence_days.includes(day)
        ? prev.recurrence_days.filter((d) => d !== day)
        : [...prev.recurrence_days, day],
    }));
  };

  return (
    <Modal title={isEdit ? 'Edit Task' : 'Add Task'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div className="form-group">
          <label className="form-label">Task name *</label>
          <input
            className="form-input"
            placeholder="e.g. Complete Python practice"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus
          />
          {errors.title && <span className="form-error">{errors.title}</span>}
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Optional details…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{ minHeight: 56 }}
          />
        </div>

        {/* Date & Time */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input
              type="date"
              className="form-input"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
            {errors.due_date && <span className="form-error">{errors.due_date}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Time</label>
            <input
              type="time"
              className="form-input"
              value={form.due_time}
              onChange={(e) => setForm({ ...form, due_time: e.target.value })}
            />
          </div>
        </div>

        {/* Priority */}
        <div className="form-group">
          <label className="form-label">Priority</label>
          <div className="tm-priority-picker">
            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                className={`tm-priority-btn${form.priority === key ? ' active' : ''}`}
                style={{
                  '--pri-color': cfg.color,
                  '--pri-bg': cfg.bg,
                }}
                onClick={() => setForm({ ...form, priority: key })}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recurrence */}
        <div className="form-group">
          <label className="form-label">Repeat</label>
          <select
            className="form-select"
            value={form.recurrence_type}
            onChange={(e) =>
              setForm({ ...form, recurrence_type: e.target.value, recurrence_days: [] })
            }
          >
            {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Weekly day picker */}
        {form.recurrence_type === 'weekly' && (
          <div className="form-group">
            <label className="form-label">Repeat on</label>
            <div className="tm-day-picker">
              {DAY_NAMES.map((name, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`tm-day-btn${form.recurrence_days.includes(idx) ? ' active' : ''}`}
                  onClick={() => toggleDay(idx)}
                >
                  {name}
                </button>
              ))}
            </div>
            {errors.recurrence_days && (
              <span className="form-error">{errors.recurrence_days}</span>
            )}
          </div>
        )}

        {/* Custom interval */}
        {(form.recurrence_type === 'custom' || form.recurrence_type === 'daily' || form.recurrence_type === 'monthly') && (
          <div className="form-group">
            <label className="form-label">
              Every {form.recurrence_type === 'daily' ? 'day(s)' : form.recurrence_type === 'monthly' ? 'month(s)' : 'day(s)'}
            </label>
            <input
              type="number"
              className="form-input"
              min={1}
              max={365}
              value={form.recurrence_interval}
              onChange={(e) =>
                setForm({ ...form, recurrence_interval: parseInt(e.target.value) || 1 })
              }
              style={{ width: 100 }}
            />
          </div>
        )}

        {/* Recurrence end */}
        {form.recurrence_type !== 'none' && (
          <div className="form-group">
            <label className="form-label">End date (optional)</label>
            <input
              type="date"
              className="form-input"
              value={form.recurrence_end}
              onChange={(e) => setForm({ ...form, recurrence_end: e.target.value })}
            />
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {isEdit ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── Delete Confirmation ─────────────────────────────────
// ═══════════════════════════════════════════════════════════

function DeleteConfirmModal({ task, onDelete, onClose }) {
  const isRecurring = task._isRecurring || task.recurrence_type !== 'none';

  return (
    <Modal title="Delete Task" onClose={onClose}>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
        {isRecurring
          ? 'This is a recurring task. What would you like to delete?'
          : 'This action cannot be undone.'}
      </p>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '1.25rem' }}>
        {task.title}
      </div>
      {isRecurring ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => onDelete('future')}>
            Delete all future occurrences
          </button>
          <button className="btn btn-danger" onClick={() => onDelete('all')}>
            Delete entire recurring task
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={() => onDelete('all')}>
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </Modal>
  );
}
