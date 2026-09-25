import {
  format,
  parseISO,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  isLeapYear,
  isBefore,
  isAfter,
  isSameDay,
  differenceInDays,
  getDay,
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
} from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────

/** Get a local-date string (YYYY-MM-DD) without timezone shift */
export function toLocalDateStr(date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd');
}

export function today() {
  return toLocalDateStr(new Date());
}

// ─── Recurrence Logic ────────────────────────────────────

/**
 * Determine whether a task is "applicable" (scheduled) on a given date.
 * Returns true if the task should appear on that date.
 */
export function isTaskApplicableOnDate(task, dateStr) {
  const date = parseISO(dateStr);
  const dueDate = parseISO(task.due_date);

  // If the date is before the task was created / due, it's not applicable
  if (isBefore(date, startOfDay(dueDate))) return false;

  // Check recurrence end date
  if (task.recurrence_end && isAfter(date, parseISO(task.recurrence_end))) {
    return false;
  }

  const type = task.recurrence_type || 'none';
  const interval = task.recurrence_interval || 1;

  switch (type) {
    case 'none':
      return isSameDay(date, dueDate);

    case 'daily': {
      const diff = differenceInDays(date, dueDate);
      return diff >= 0 && diff % interval === 0;
    }

    case 'weekly': {
      const days = task.recurrence_days || [];
      if (days.length === 0) {
        // Default: same day of week as due date
        const diff = differenceInDays(date, dueDate);
        return diff >= 0 && diff % (7 * interval) === 0;
      }
      // Check if the day-of-week is in the selected days
      const dayOfWeek = getDay(date); // 0=Sun … 6=Sat
      if (!days.includes(dayOfWeek)) return false;

      // For interval > 1, check week alignment
      if (interval === 1) return true;
      const weeksDiff = Math.floor(differenceInDays(date, dueDate) / 7);
      return weeksDiff % interval === 0;
    }

    case 'monthly': {
      if (dueDate.getDate() !== date.getDate()) return false;
      const monthsDiff =
        (date.getFullYear() - dueDate.getFullYear()) * 12 +
        (date.getMonth() - dueDate.getMonth());
      return monthsDiff >= 0 && monthsDiff % interval === 0;
    }

    case 'custom': {
      // Custom behaves like daily with the given interval
      const diff = differenceInDays(date, dueDate);
      return diff >= 0 && diff % interval === 0;
    }

    default:
      return isSameDay(date, dueDate);
  }
}

// ─── Daily Task Resolution ───────────────────────────────

/**
 * Given all tasks and completions, compute the list of "virtual" tasks
 * applicable on a specific date with their completion status.
 */
export function getTasksForDate(tasks, completions, dateStr) {
  const completionSet = new Set(
    completions
      .filter((c) => c.completion_date === dateStr)
      .map((c) => c.task_id)
  );

  return tasks
    .filter((task) => isTaskApplicableOnDate(task, dateStr))
    .map((task) => {
      const isRecurring = task.recurrence_type !== 'none';
      const isCompleted = isRecurring
        ? completionSet.has(task.id)
        : task.completed;
      return { ...task, _dateStr: dateStr, _isCompleted: isCompleted, _isRecurring: isRecurring };
    });
}

/**
 * Get today's tasks
 */
export function getTodayTasks(tasks, completions) {
  return getTasksForDate(tasks, completions, today());
}

/**
 * Get upcoming tasks (next 7 days, excluding today)
 */
export function getUpcomingTasks(tasks, completions, days = 7) {
  const result = [];
  const now = new Date();
  for (let i = 1; i <= days; i++) {
    const d = addDays(now, i);
    const dateStr = toLocalDateStr(d);
    const dayTasks = getTasksForDate(tasks, completions, dateStr);
    result.push(...dayTasks);
  }
  return result;
}

/**
 * Get overdue tasks (past tasks that are not completed)
 */
export function getOverdueTasks(tasks, completions) {
  const todayStr = today();
  const result = [];
  // Check the last 90 days for overdue tasks
  const now = new Date();
  for (let i = 1; i <= 90; i++) {
    const d = addDays(now, -i);
    const dateStr = toLocalDateStr(d);
    const dayTasks = getTasksForDate(tasks, completions, dateStr);
    const overdue = dayTasks.filter((t) => !t._isCompleted);
    result.push(...overdue);
  }
  return result;
}

/**
 * Get all completed tasks
 */
export function getCompletedTasks(tasks, completions) {
  const completed = [];
  // Non-recurring completed tasks
  tasks
    .filter((t) => t.recurrence_type === 'none' && t.completed)
    .forEach((t) =>
      completed.push({ ...t, _dateStr: t.due_date, _isCompleted: true, _isRecurring: false })
    );
  // Recurring completions
  completions.forEach((c) => {
    const task = tasks.find((t) => t.id === c.task_id);
    if (task) {
      completed.push({
        ...task,
        _dateStr: c.completion_date,
        _isCompleted: true,
        _isRecurring: true,
        _completionId: c.id,
      });
    }
  });
  return completed.sort((a, b) => b._dateStr.localeCompare(a._dateStr));
}

// ─── Analytics ───────────────────────────────────────────

/**
 * Daily completion rate for a date
 */
export function getDailyCompletionRate(tasks, completions, dateStr) {
  const dayTasks = getTasksForDate(tasks, completions, dateStr);
  if (dayTasks.length === 0) return null; // No tasks scheduled
  const completed = dayTasks.filter((t) => t._isCompleted).length;
  return Math.round((completed / dayTasks.length) * 100);
}

/**
 * Overall consistency score: average daily completion rate
 * over days that had scheduled tasks, within a given range.
 */
export function getConsistencyScore(tasks, completions, daysBack = 30) {
  const now = new Date();
  let totalRate = 0;
  let daysWithTasks = 0;

  for (let i = 0; i < daysBack; i++) {
    const d = addDays(now, -i);
    const dateStr = toLocalDateStr(d);
    const rate = getDailyCompletionRate(tasks, completions, dateStr);
    if (rate !== null) {
      totalRate += rate;
      daysWithTasks++;
    }
  }

  if (daysWithTasks === 0) return { score: null, scheduledDays: 0, totalDays: daysBack };
  return {
    score: Math.round(totalRate / daysWithTasks),
    scheduledDays: daysWithTasks,
    totalDays: daysBack,
  };
}

/**
 * Current streak: consecutive days (going backward) where ALL scheduled tasks were completed.
 * Days with zero tasks are skipped (not counted as failed).
 */
export function getCurrentStreak(tasks, completions) {
  const now = new Date();
  let streak = 0;
  let i = 0;

  // Start from today
  while (i < 365) {
    const d = addDays(now, -i);
    const dateStr = toLocalDateStr(d);
    const rate = getDailyCompletionRate(tasks, completions, dateStr);

    if (rate === null) {
      // No tasks — skip this day
      i++;
      continue;
    }

    if (rate === 100) {
      streak++;
      i++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Longest streak ever
 */
export function getLongestStreak(tasks, completions) {
  const now = new Date();
  let longest = 0;
  let current = 0;

  // Check last 365 days
  for (let i = 364; i >= 0; i--) {
    const d = addDays(now, -i);
    const dateStr = toLocalDateStr(d);
    const rate = getDailyCompletionRate(tasks, completions, dateStr);

    if (rate === null) continue; // skip

    if (rate === 100) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }

  return longest;
}

/**
 * Year progress info
 */
export function getYearProgress() {
  const now = new Date();
  const year = now.getFullYear();
  const totalDays = isLeapYear(now) ? 366 : 365;
  const start = startOfYear(now);
  const daysPassed = differenceInDays(now, start) + 1; // include today
  const daysRemaining = totalDays - daysPassed;
  return { year, totalDays, daysPassed, daysRemaining };
}

/**
 * Weekly completion data (last 7 days)
 */
export function getWeeklyData(tasks, completions) {
  const now = new Date();
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(now, -i);
    const dateStr = toLocalDateStr(d);
    const dayTasks = getTasksForDate(tasks, completions, dateStr);
    const completedCount = dayTasks.filter((t) => t._isCompleted).length;
    result.push({
      date: dateStr,
      dayName: format(d, 'EEE'),
      dayLabel: format(d, 'MMM d'),
      total: dayTasks.length,
      completed: completedCount,
      rate: dayTasks.length > 0 ? Math.round((completedCount / dayTasks.length) * 100) : null,
    });
  }
  return result;
}

/**
 * Year completion heatmap data
 */
export function getYearHeatmapData(tasks, completions) {
  const now = new Date();
  const start = startOfYear(now);
  const end = new Date(now); // up to today
  const days = eachDayOfInterval({ start, end });

  return days.map((d) => {
    const dateStr = toLocalDateStr(d);
    const dayTasks = getTasksForDate(tasks, completions, dateStr);
    const completedCount = dayTasks.filter((t) => t._isCompleted).length;
    return {
      date: dateStr,
      total: dayTasks.length,
      completed: completedCount,
      rate: dayTasks.length > 0 ? Math.round((completedCount / dayTasks.length) * 100) : null,
    };
  });
}

/**
 * Map a completion rate to a heatmap intensity level (0–4)
 */
export function getHeatmapLevel(rate) {
  if (rate === null || rate === undefined) return 0;
  if (rate === 0) return 0;
  if (rate <= 25) return 1;
  if (rate <= 50) return 2;
  if (rate <= 75) return 3;
  return 4;
}

/**
 * Get tasks for a month's calendar view
 */
export function getMonthTaskMap(tasks, completions, year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const days = eachDayOfInterval({ start, end });

  const map = {};
  days.forEach((d) => {
    const dateStr = toLocalDateStr(d);
    const dayTasks = getTasksForDate(tasks, completions, dateStr);
    if (dayTasks.length > 0) {
      map[dateStr] = {
        total: dayTasks.length,
        completed: dayTasks.filter((t) => t._isCompleted).length,
        tasks: dayTasks,
      };
    }
  });
  return map;
}
