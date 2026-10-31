import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Award,
  BookOpen,
  ArrowRight,
  AlertCircle,
  Sparkles,
  PartyPopper,
  BellRing,
  Check,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { FocusTaskModal } from '../components/focus/FocusTaskModal';
import {
  focusTaskService,
  formatMinutesHuman,
  formatSecondsHuman,
  formatTimerCountdown,
} from '../services/focusTask.service';
import type { FocusTask, FocusTaskForm, DailyStudySummary } from '../types/focusTask.types';

// Storage key for active running timer state
const TIMER_STATE_KEY = 'studyspace_focus_timer_active_v1';

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Continuous alarm chime manager.
 * Repeats melodic notification chime every 1.8 seconds until explicitly stopped by the user clicking Done.
 */
class FocusAlarmSound {
  private ctx: AudioContext | null = null;
  private intervalId: number | null = null;
  public isRinging: boolean = false;

  private initCtx() {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private playTone(freq: number, startDelay: number, duration: number, volume: number = 0.25) {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime + startDelay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Audio autoplay restrictions
    }
  }

  private playChimeBurst() {
    this.initCtx();
    if (!this.ctx) return;
    // Pleasant melodic 3-tone notification chime: D5 (587.33Hz) -> F#5 (739.99Hz) -> A5 (880.00Hz)
    this.playTone(587.33, 0.0, 0.45, 0.22);
    this.playTone(739.99, 0.16, 0.45, 0.22);
    this.playTone(880.00, 0.32, 0.75, 0.26);
  }

  public start() {
    if (this.isRinging) return;
    this.isRinging = true;
    this.playChimeBurst();

    // Repeat chime burst every 1.8 seconds until stopped by user clicking Done
    this.intervalId = window.setInterval(() => {
      this.playChimeBurst();
    }, 1800);
  }

  public stop() {
    this.isRinging = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export function PandoraTimerPage() {
  const { user } = useAuth();
  const today = getTodayISO();

  // ─── Today's Tasks & Summary ─────────────────────────────────
  const [todayTasks, setTodayTasks] = useState<FocusTask[]>([]);
  const [loadingToday, setLoadingToday] = useState(true);

  // ─── Selected Task in Timer ──────────────────────────────────
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');

  // ─── Timer State ─────────────────────────────────────────────
  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [totalPlannedSeconds, setTotalPlannedSeconds] = useState<number>(0);
  const [completedNotification, setCompletedNotification] = useState<{
    taskName: string;
    plannedMins: number;
    actualSecs: number;
  } | null>(null);

  // ─── Continuous Alarm Sound Manager ──────────────────────────
  const alarmSoundRef = useRef<FocusAlarmSound>(new FocusAlarmSound());
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);

  // ─── Task Modal State ────────────────────────────────────────
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FocusTask | null>(null);

  // ─── History State ───────────────────────────────────────────
  const [historyDate, setHistoryDate] = useState<string>(getYesterdayISO);
  const [historyTasks, setHistoryTasks] = useState<FocusTask[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const timerRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(Date.now());

  // Currently selected task object
  const currentTask = todayTasks.find((t) => t.id === selectedTaskId) || null;

  // ─── Load Today's Tasks ──────────────────────────────────────
  const loadTodayTasks = useCallback(async () => {
    if (!user) return;
    try {
      const tasks = await focusTaskService.getTasksByDate(user.id, today);
      setTodayTasks(tasks);

      // If no task selected yet, default to first uncompleted task
      setSelectedTaskId((prev) => {
        if (prev && tasks.some((t) => t.id === prev)) return prev;
        const firstUncompleted = tasks.find((t) => t.status !== 'completed');
        return firstUncompleted ? firstUncompleted.id : tasks[0]?.id || '';
      });
    } catch (err) {
      console.error('[FocusTimer] Failed to load today tasks:', err);
    } finally {
      setLoadingToday(false);
    }
  }, [user, today]);

  // ─── Load History Tasks for Selected Date ────────────────────
  const loadHistoryTasks = useCallback(async () => {
    if (!user || !historyDate) return;
    setLoadingHistory(true);
    try {
      const tasks = await focusTaskService.getTasksByDate(user.id, historyDate);
      setHistoryTasks(tasks);
    } catch (err) {
      console.error('[FocusTimer] Failed to load history tasks:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [user, historyDate]);

  useEffect(() => {
    loadTodayTasks();
  }, [loadTodayTasks]);

  useEffect(() => {
    loadHistoryTasks();
  }, [loadHistoryTasks]);

  // ─── Restore Timer State on Mount (or Page Refresh) ──────────
  useEffect(() => {
    if (!user) return;
    try {
      const savedRaw = localStorage.getItem(`${TIMER_STATE_KEY}_${user.id}`);
      if (!savedRaw) return;
      const saved = JSON.parse(savedRaw);

      if (saved.taskId && saved.totalPlannedSeconds > 0) {
        setSelectedTaskId(saved.taskId);
        setTotalPlannedSeconds(saved.totalPlannedSeconds);

        if (saved.status === 'running') {
          const elapsed = Math.floor((Date.now() - saved.lastTickTimestamp) / 1000);
          const nextRemaining = Math.max(0, saved.remainingSeconds - elapsed);
          setRemainingSeconds(nextRemaining);

          if (nextRemaining > 0) {
            setTimerStatus('running');
            // Record elapsed time to task progress
            focusTaskService.recordProgress(user.id, saved.taskId, elapsed, false).catch(console.error);
          } else {
            // Completed while away
            setTimerStatus('completed');
            focusTaskService.recordProgress(user.id, saved.taskId, saved.remainingSeconds, true).then(() => {
              loadTodayTasks();
            });
          }
        } else if (saved.status === 'paused') {
          setTimerStatus('paused');
          setRemainingSeconds(saved.remainingSeconds);
        }
      }
    } catch (err) {
      console.warn('[FocusTimer] Failed to restore active timer state:', err);
    }
  }, [user, loadTodayTasks]);

  // ─── Update Timer When Selected Task Changes ─────────────────
  useEffect(() => {
    if (!currentTask) {
      if (timerStatus === 'idle') {
        setRemainingSeconds(0);
        setTotalPlannedSeconds(0);
      }
      return;
    }

    // Only update if idle or if switching tasks when not running
    if (timerStatus === 'idle' || timerStatus === 'completed') {
      const plannedSecs = (currentTask.planned_duration_minutes || 30) * 60;
      const remainingSecs = Math.max(0, plannedSecs - (currentTask.actual_duration_seconds || 0));

      setTotalPlannedSeconds(plannedSecs);
      setRemainingSeconds(remainingSecs > 0 ? remainingSecs : plannedSecs);
      if (timerStatus === 'completed') setTimerStatus('idle');
    }
  }, [selectedTaskId, currentTask, timerStatus]);

  // ─── Persist Running Timer State to LocalStorage ─────────────
  useEffect(() => {
    if (!user) return;
    if (timerStatus === 'running' || timerStatus === 'paused') {
      const state = {
        taskId: selectedTaskId,
        status: timerStatus,
        remainingSeconds,
        totalPlannedSeconds,
        lastTickTimestamp: Date.now(),
      };
      localStorage.setItem(`${TIMER_STATE_KEY}_${user.id}`, JSON.stringify(state));
    } else {
      localStorage.removeItem(`${TIMER_STATE_KEY}_${user.id}`);
    }
  }, [user, timerStatus, selectedTaskId, remainingSeconds, totalPlannedSeconds]);

  // ─── Countdown Ticker Interval ───────────────────────────────
  useEffect(() => {
    if (timerStatus !== 'running') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    lastTickTimeRef.current = Date.now();

    timerRef.current = window.setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.round((now - lastTickTimeRef.current) / 1000);
      if (elapsedSeconds < 1) return;

      lastTickTimeRef.current = now;

      setRemainingSeconds((prev) => {
        const next = Math.max(0, prev - elapsedSeconds);

        // Record progress incrementally every second
        if (user && selectedTaskId) {
          focusTaskService.recordProgress(user.id, selectedTaskId, elapsedSeconds, next === 0).then(() => {
            // Keep today's tasks updated
            setTodayTasks((prevTasks) =>
              prevTasks.map((t) =>
                t.id === selectedTaskId
                  ? {
                      ...t,
                      actual_duration_seconds: t.actual_duration_seconds + elapsedSeconds,
                      status: next === 0 ? 'completed' : 'in_progress',
                    }
                  : t
              )
            );
          });
        }

        // When timer reaches zero
        if (next === 0) {
          setTimerStatus('completed');
          setIsAlarmRinging(true);
          alarmSoundRef.current.start();

          if (currentTask) {
            setCompletedNotification({
              taskName: currentTask.task_name,
              plannedMins: currentTask.planned_duration_minutes,
              actualSecs: currentTask.actual_duration_seconds + elapsedSeconds,
            });
          }

          loadTodayTasks();
        }

        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timerStatus, user, selectedTaskId, currentTask, loadTodayTasks]);

  // ─── Cleanup Alarm Sound on Unmount ──────────────────────────
  useEffect(() => {
    return () => {
      alarmSoundRef.current.stop();
    };
  }, []);

  // ─── Stop Alarm and Mark Complete / Done ─────────────────────
  const handleStopAlarmAndDone = useCallback(() => {
    alarmSoundRef.current.stop();
    setIsAlarmRinging(false);
    setCompletedNotification(null);
    setTimerStatus('idle');
  }, []);

  // ─── Keyboard Shortcut: Space or Enter dismisses ringing alarm ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAlarmRinging) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleStopAlarmAndDone();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAlarmRinging, handleStopAlarmAndDone]);

  // ─── Timer Action Handlers ───────────────────────────────────
  const handleStart = () => {
    alarmSoundRef.current.stop();
    setIsAlarmRinging(false);
    if (!selectedTaskId) {
      alert('Please select or create a study task first.');
      return;
    }
    if (remainingSeconds <= 0 && currentTask) {
      // If task was already completed or 0 remaining, reset to planned duration
      const plannedSecs = currentTask.planned_duration_minutes * 60;
      setRemainingSeconds(plannedSecs);
      setTotalPlannedSeconds(plannedSecs);
    }
    setCompletedNotification(null);
    setTimerStatus('running');
  };

  const handlePause = () => {
    setTimerStatus('paused');
  };

  const handleResume = () => {
    setTimerStatus('running');
  };

  const handleReset = () => {
    alarmSoundRef.current.stop();
    setIsAlarmRinging(false);
    if (!currentTask) return;
    if (timerStatus === 'running' && !window.confirm('Reset the current countdown?')) {
      return;
    }
    setTimerStatus('idle');
    const plannedSecs = currentTask.planned_duration_minutes * 60;
    setRemainingSeconds(plannedSecs);
    setTotalPlannedSeconds(plannedSecs);
    setCompletedNotification(null);
  };

  // ─── Task Selection Handler ──────────────────────────────────
  const handleSelectTask = (taskId: string) => {
    alarmSoundRef.current.stop();
    setIsAlarmRinging(false);

    if (taskId === '__NEW__') {
      setEditingTask(null);
      setIsTaskModalOpen(true);
      return;
    }

    if (timerStatus === 'running') {
      if (!window.confirm('Switching tasks will pause your current session. Continue?')) {
        return;
      }
      setTimerStatus('paused');
    }

    setSelectedTaskId(taskId);
    setCompletedNotification(null);

    const task = todayTasks.find((t) => t.id === taskId);
    if (task) {
      const plannedSecs = task.planned_duration_minutes * 60;
      const remainingSecs = Math.max(0, plannedSecs - task.actual_duration_seconds);
      setTotalPlannedSeconds(plannedSecs);
      setRemainingSeconds(remainingSecs > 0 ? remainingSecs : plannedSecs);
      if (timerStatus !== 'paused') {
        setTimerStatus('idle');
      }
    }
  };

  // ─── Task Modal Handlers ─────────────────────────────────────
  const handleSaveTask = async (form: FocusTaskForm, taskId?: string) => {
    if (!user) return;
    if (taskId) {
      await focusTaskService.updateTask(user.id, taskId, form);
    } else {
      const created = await focusTaskService.createTask(user.id, form);
      // If task was for today, select it in the timer
      if (form.date === today) {
        setSelectedTaskId(created.id);
      }
    }
    await loadTodayTasks();
    if (form.date === historyDate) {
      await loadHistoryTasks();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    await focusTaskService.deleteTask(user.id, taskId);
    if (selectedTaskId === taskId) {
      setSelectedTaskId('');
      setTimerStatus('idle');
      setRemainingSeconds(0);
      setTotalPlannedSeconds(0);
    }
    await loadTodayTasks();
    await loadHistoryTasks();
  };

  // ─── Summaries ───────────────────────────────────────────────
  const todaySummary = focusTaskService.getDailySummary(todayTasks, today);
  const historySummary = focusTaskService.getDailySummary(historyTasks, historyDate);

  // ─── SVG Circular Progress Math ──────────────────────────────
  const svgSize = 280;
  const strokeWidth = 12;
  const radius = (svgSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = totalPlannedSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalPlannedSeconds)) : 1;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div className="focus-page-container" style={{ animation: 'fadeIn 0.2s ease', maxWidth: 960, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* ── Page Header ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(99, 102, 241, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1',
            }}
          >
            <Clock size={20} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Focus Timer & Daily Study Tracker
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Select your study task, set your time limit, and dive into focused learning with automatic progress tracking.
        </p>
      </div>

      {/* ── SECTION 1: FOCUS TIMER WITH TASK SELECTION ── */}
      <div
        className="card"
        style={{
          padding: '1.75rem 1.5rem',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--card-bg, #fff)',
          marginBottom: '1.5rem',
          boxShadow: 'var(--card-shadow, 0 1px 3px rgba(0,0,0,0.05))',
        }}
      >
        {/* Task Selector Dropdown Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label className="ssc-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 8, display: 'block' }}>
            Choose Study Task for Focus Session
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              className="ssc-input"
              style={{
                flex: 1,
                minWidth: 260,
                fontSize: '0.925rem',
                fontWeight: 500,
                padding: '10px 14px',
              }}
              value={selectedTaskId}
              onChange={(e) => handleSelectTask(e.target.value)}
            >
              {todayTasks.length === 0 && (
                <option value="">— No tasks added for today yet —</option>
              )}
              {todayTasks.map((task) => {
                const isDone = task.status === 'completed';
                return (
                  <option key={task.id} value={task.id}>
                    {isDone ? '✓ ' : '○ '}
                    {task.task_name} • {formatMinutesHuman(task.planned_duration_minutes)}
                    {task.category ? ` [${task.category}]` : ''}
                    {isDone ? ' (Completed)' : ''}
                  </option>
                );
              })}
              <option value="__NEW__">+ Add New Task...</option>
            </select>

            <button
              type="button"
              className="ssc-btn ssc-btn-primary"
              onClick={() => {
                setEditingTask(null);
                setIsTaskModalOpen(true);
              }}
              style={{ padding: '10px 16px', gap: 6, whiteSpace: 'nowrap' }}
            >
              <Plus size={16} />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        {/* Selected Task Details Banner */}
        {currentTask ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              background: 'var(--bg-subtle, rgba(99, 102, 241, 0.05))',
              borderRadius: 8,
              border: '1px solid var(--border-subtle, rgba(99, 102, 241, 0.15))',
              marginBottom: '1.75rem',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                  Active Focus Task
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {currentTask.task_name}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {currentTask.category && (
                <span className="ssc-badge" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
                  {currentTask.category}
                </span>
              )}
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Target: <strong>{formatMinutesHuman(currentTask.planned_duration_minutes)}</strong>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Studied: <strong>{formatSecondsHuman(currentTask.actual_duration_seconds)}</strong>
              </div>
              <span
                className="ssc-badge"
                style={{
                  background: currentTask.status === 'completed'
                    ? 'rgba(16, 185, 129, 0.12)'
                    : currentTask.status === 'in_progress'
                    ? 'rgba(59, 130, 246, 0.12)'
                    : 'var(--bg-subtle, rgba(0,0,0,0.06))',
                  color: currentTask.status === 'completed'
                    ? '#10b981'
                    : currentTask.status === 'in_progress'
                    ? '#3b82f6'
                    : 'var(--text-muted)',
                }}
              >
                {currentTask.status === 'completed' ? 'Completed' : currentTask.status === 'in_progress' ? 'In Progress' : 'Pending'}
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: 'var(--bg-subtle, rgba(0,0,0,0.02))',
              border: '1px dashed var(--border)',
              textAlign: 'center',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              marginBottom: '1.5rem',
            }}
          >
            Please add or select a study task above to start your timer.
          </div>
        )}

        {/* Completion Message Banner */}
        {(completedNotification || isAlarmRinging) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '2px solid rgba(16, 185, 129, 0.5)',
              marginBottom: '1.5rem',
              gap: 14,
              animation: 'fadeIn 0.3s ease',
              flexWrap: 'wrap',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  flexShrink: 0,
                }}
              >
                <BellRing size={24} style={{ animation: isAlarmRinging ? 'pulse 1s infinite' : 'none' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🎉 Task Completed! Time is up!</span>
                  {isAlarmRinging && (
                    <span
                      className="ssc-badge"
                      style={{ background: '#10b981', color: '#fff', fontSize: '0.675rem', padding: '2px 7px', fontWeight: 600 }}
                    >
                      Sound Playing
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#047857', marginTop: 3 }}>
                  {completedNotification ? (
                    <>
                      You finished <strong>"{completedNotification.taskName}"</strong> ({formatSecondsHuman(completedNotification.actualSecs)} studied). Click <strong>Done</strong> to stop the notification sound.
                    </>
                  ) : (
                    'Your study session has finished. Click Done to stop the sound.'
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="ssc-btn ssc-btn-primary"
              style={{
                padding: '10px 24px',
                fontSize: '0.95rem',
                fontWeight: 700,
                background: '#10b981',
                borderColor: '#059669',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                gap: 8,
                borderRadius: 8,
              }}
              onClick={handleStopAlarmAndDone}
            >
              <Check size={18} />
              <span>Done (Stop Sound)</span>
            </button>
          </div>
        )}

        {/* Circular Countdown Timer Display */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '1rem 0 1.5rem' }}>
          <div style={{ position: 'relative', width: svgSize, height: svgSize }}>
            <svg width={svgSize} height={svgSize} style={{ transform: 'rotate(-90deg)' }}>
              {/* Background ring */}
              <circle
                cx={svgSize / 2}
                cy={svgSize / 2}
                r={radius}
                stroke="var(--border, rgba(0,0,0,0.08))"
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Animated Progress ring */}
              <circle
                cx={svgSize / 2}
                cy={svgSize / 2}
                r={radius}
                stroke={timerStatus === 'running' ? '#6366f1' : timerStatus === 'paused' ? '#f59e0b' : timerStatus === 'completed' ? '#10b981' : '#a5b4fc'}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
              />
            </svg>

            {/* Inner Timer Text Overlay */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '0 20px',
              }}
            >
              <div
                style={{
                  fontSize: '2.75rem',
                  fontWeight: 700,
                  fontFamily: 'Inter, monospace',
                  letterSpacing: '-0.03em',
                  color: 'var(--text-main)',
                  lineHeight: 1.1,
                }}
              >
                {formatTimerCountdown(remainingSeconds)}
              </div>

              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginTop: 6,
                  color: timerStatus === 'running' ? '#6366f1' : timerStatus === 'paused' ? '#f59e0b' : timerStatus === 'completed' ? '#10b981' : 'var(--text-muted)',
                }}
              >
                {timerStatus === 'running' ? 'Focusing...' : timerStatus === 'paused' ? 'Paused' : timerStatus === 'completed' ? 'Completed' : 'Ready'}
              </div>

              {currentTask && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 4,
                  }}
                  title={currentTask.task_name}
                >
                  {currentTask.task_name}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timer Control Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {isAlarmRinging ? (
            <>
              <button
                type="button"
                className="ssc-btn ssc-btn-primary"
                style={{
                  padding: '14px 32px',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  background: '#10b981',
                  borderColor: '#059669',
                  boxShadow: '0 4px 18px rgba(16, 185, 129, 0.4)',
                  gap: 8,
                  borderRadius: 12,
                }}
                onClick={handleStopAlarmAndDone}
              >
                <Check size={20} />
                <span>Done (Stop Sound)</span>
              </button>

              <button
                type="button"
                className="ssc-btn ssc-btn-outline"
                style={{ padding: '14px 22px', borderRadius: 12, gap: 6 }}
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Restart Task</span>
              </button>
            </>
          ) : timerStatus === 'idle' ? (
            <button
              type="button"
              className="ssc-btn ssc-btn-primary"
              style={{
                padding: '12px 28px',
                fontSize: '1rem',
                fontWeight: 600,
                gap: 8,
                borderRadius: 10,
              }}
              onClick={handleStart}
              disabled={!selectedTaskId}
            >
              <Play size={18} fill="currentColor" />
              <span>Start Focus</span>
            </button>
          ) : null}

          {timerStatus === 'running' && (
            <>
              <button
                type="button"
                className="ssc-btn"
                style={{
                  padding: '12px 24px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  gap: 8,
                  borderRadius: 10,
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#d97706',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
                onClick={handlePause}
              >
                <Pause size={18} />
                <span>Pause</span>
              </button>

              <button
                type="button"
                className="ssc-btn ssc-btn-outline"
                style={{ padding: '12px 20px', borderRadius: 10, gap: 6 }}
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Reset</span>
              </button>
            </>
          )}

          {timerStatus === 'paused' && (
            <>
              <button
                type="button"
                className="ssc-btn ssc-btn-primary"
                style={{
                  padding: '12px 24px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  gap: 8,
                  borderRadius: 10,
                }}
                onClick={handleResume}
              >
                <Play size={18} fill="currentColor" />
                <span>Resume</span>
              </button>

              <button
                type="button"
                className="ssc-btn ssc-btn-outline"
                style={{ padding: '12px 20px', borderRadius: 10, gap: 6 }}
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Reset</span>
              </button>
            </>
          )}

          {timerStatus === 'completed' && !isAlarmRinging && (
            <button
              type="button"
              className="ssc-btn ssc-btn-outline"
              style={{ padding: '12px 24px', borderRadius: 10, gap: 6 }}
              onClick={handleReset}
            >
              <RotateCcw size={16} />
              <span>Restart Task</span>
            </button>
          )}
        </div>
      </div>

      {/* ── SECTION 2: TODAY'S STUDY ACTIVITY SUMMARY ── */}
      <div
        className="card"
        style={{
          padding: '1.25rem',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--card-bg, #fff)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Today's Study Activity
            </h2>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6366f1' }}>
            {todaySummary.completionRatePct}% Completed
          </div>
        </div>

        {/* 5 Summary Metrics Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
            marginBottom: '1rem',
          }}
        >
          <div className="ds-stat-card">
            <span className="ds-stat-label">Total Tasks</span>
            <div className="ds-stat-value">{todaySummary.totalTasks}</div>
          </div>

          <div className="ds-stat-card">
            <span className="ds-stat-label" style={{ color: '#10b981' }}>Completed</span>
            <div className="ds-stat-value" style={{ color: '#10b981' }}>{todaySummary.completedTasks}</div>
          </div>

          <div className="ds-stat-card">
            <span className="ds-stat-label" style={{ color: '#f59e0b' }}>Remaining</span>
            <div className="ds-stat-value" style={{ color: '#f59e0b' }}>{todaySummary.remainingTasks}</div>
          </div>

          <div className="ds-stat-card">
            <span className="ds-stat-label">Planned Time</span>
            <div className="ds-stat-value" style={{ fontSize: '1.15rem' }}>
              {formatMinutesHuman(todaySummary.totalPlannedMinutes)}
            </div>
          </div>

          <div className="ds-stat-card">
            <span className="ds-stat-label" style={{ color: '#6366f1' }}>Actual Focus Time</span>
            <div className="ds-stat-value" style={{ fontSize: '1.15rem', color: '#6366f1' }}>
              {formatSecondsHuman(todaySummary.totalActualSeconds)}
            </div>
          </div>
        </div>

        {/* Study Progress Bar */}
        <div>
          <div
            style={{
              height: 7,
              background: 'var(--border, rgba(0,0,0,0.08))',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${todaySummary.completionRatePct}%`,
                background: todaySummary.completionRatePct >= 100 ? '#10b981' : 'linear-gradient(90deg, #6366f1, #818cf8)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 3: TASK MANAGEMENT AREA ── */}
      <div
        className="card"
        style={{
          padding: '1.25rem',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--card-bg, #fff)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Today's Task Checklist
            </h2>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Add multiple study tasks with time limits in hours or minutes
            </span>
          </div>

          <button
            type="button"
            className="ssc-btn ssc-btn-primary"
            style={{ fontSize: '0.8rem', padding: '6px 12px', gap: 6 }}
            onClick={() => {
              setEditingTask(null);
              setIsTaskModalOpen(true);
            }}
          >
            <Plus size={14} />
            <span>Add Study Task</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todayTasks.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No study tasks added for today yet. Click <strong>"Add Study Task"</strong> to set your daily plan!
            </div>
          ) : (
            todayTasks.map((task) => {
              const isDone = task.status === 'completed';
              const isInProgress = task.status === 'in_progress';
              const isSelectedInTimer = selectedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: isSelectedInTimer ? '1px solid #6366f1' : '1px solid var(--border)',
                    background: isSelectedInTimer ? 'rgba(99, 102, 241, 0.03)' : isDone ? 'rgba(16, 185, 129, 0.02)' : 'var(--card-bg, #fff)',
                    gap: 10,
                    flexWrap: 'wrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Left: Status Icon & Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 }}>
                    <div style={{ color: isDone ? '#10b981' : isInProgress ? '#3b82f6' : 'var(--text-muted)', flexShrink: 0 }}>
                      {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '0.925rem',
                            color: isDone ? 'var(--text-muted)' : 'var(--text-main)',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {task.task_name}
                        </span>

                        {task.category && (
                          <span
                            className="ssc-badge"
                            style={{
                              fontSize: '0.675rem',
                              padding: '2px 6px',
                              background: 'rgba(99, 102, 241, 0.08)',
                              color: '#6366f1',
                            }}
                          >
                            {task.category}
                          </span>
                        )}

                        <span
                          className="ssc-badge"
                          style={{
                            fontSize: '0.675rem',
                            padding: '2px 6px',
                            background: isDone
                              ? 'rgba(16, 185, 129, 0.12)'
                              : isInProgress
                              ? 'rgba(59, 130, 246, 0.12)'
                              : 'var(--bg-subtle, rgba(0,0,0,0.05))',
                            color: isDone ? '#10b981' : isInProgress ? '#3b82f6' : 'var(--text-muted)',
                          }}
                        >
                          {isDone ? 'Completed' : isInProgress ? 'In Progress' : 'Pending'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Planned: <strong>{formatMinutesHuman(task.planned_duration_minutes)}</strong> • Actual: <strong>{formatSecondsHuman(task.actual_duration_seconds)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className={`ssc-btn ${isSelectedInTimer ? 'ssc-btn-primary' : 'ssc-btn-outline'}`}
                      style={{ padding: '5px 10px', fontSize: '0.75rem', gap: 4 }}
                      onClick={() => handleSelectTask(task.id)}
                    >
                      <Play size={12} fill="currentColor" />
                      <span>{isSelectedInTimer ? 'Selected in Timer' : 'Focus'}</span>
                    </button>

                    <button
                      type="button"
                      className="ssc-btn ssc-btn-outline"
                      style={{ padding: '5px 8px' }}
                      onClick={() => {
                        setEditingTask(task);
                        setIsTaskModalOpen(true);
                      }}
                      title="Edit task"
                    >
                      <Edit2 size={13} />
                    </button>

                    <button
                      type="button"
                      className="ssc-btn ssc-btn-outline"
                      style={{ padding: '5px 8px', color: 'var(--color-danger, #ef4444)' }}
                      onClick={() => handleDeleteTask(task.id)}
                      title="Delete task"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── SECTION 4: PREVIOUS STUDY HISTORY ── */}
      <div
        className="card"
        style={{
          padding: '1.25rem',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--card-bg, #fff)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Previous Study History
            </h2>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Review your completed tasks and total focused study hours for any past day
            </span>
          </div>

          {/* Date Picker & Fast Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ssc-btn ssc-btn-outline"
              style={{
                padding: '4px 8px',
                fontSize: '0.75rem',
                background: historyDate === getYesterdayISO() ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                color: historyDate === getYesterdayISO() ? '#6366f1' : 'var(--text-muted)',
              }}
              onClick={() => setHistoryDate(getYesterdayISO())}
            >
              Yesterday
            </button>

            <button
              type="button"
              className="ssc-btn ssc-btn-outline"
              style={{
                padding: '4px 8px',
                fontSize: '0.75rem',
                background: historyDate === today ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                color: historyDate === today ? '#6366f1' : 'var(--text-muted)',
              }}
              onClick={() => setHistoryDate(today)}
            >
              Today
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="date"
                className="ssc-input"
                style={{ padding: '4px 8px', fontSize: '0.8rem', width: 140 }}
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Selected Date Summary Banner */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            background: 'var(--bg-subtle, rgba(0,0,0,0.02))',
            borderRadius: 8,
            border: '1px solid var(--border)',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selected Date</div>
            <div style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {new Date(historyDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Focus Time</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#6366f1' }}>
                {formatSecondsHuman(historySummary.totalActualSeconds)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tasks Completed</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>
                {historySummary.completedTasks} / {historySummary.totalTasks}
              </div>
            </div>
          </div>
        </div>

        {/* History Tasks List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadingHistory ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Loading study history...
            </div>
          ) : historyTasks.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No study activity recorded on {historyDate}.
            </div>
          ) : (
            historyTasks.map((task) => {
              const isDone = task.status === 'completed';
              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: isDone ? 'rgba(16, 185, 129, 0.02)' : 'transparent',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: isDone ? '#10b981' : 'var(--text-muted)' }}>
                      {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isDone ? 'var(--text-muted)' : 'var(--text-main)' }}>
                          {task.task_name}
                        </span>
                        {task.category && (
                          <span className="ssc-badge" style={{ fontSize: '0.675rem', padding: '1px 6px' }}>
                            {task.category}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Planned: {formatMinutesHuman(task.planned_duration_minutes)} • Actual Focus: {formatSecondsHuman(task.actual_duration_seconds)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span
                      className="ssc-badge"
                      style={{
                        fontSize: '0.675rem',
                        padding: '2px 8px',
                        background: isDone
                          ? 'rgba(16, 185, 129, 0.12)'
                          : task.status === 'in_progress'
                          ? 'rgba(59, 130, 246, 0.12)'
                          : 'var(--bg-subtle, rgba(0,0,0,0.06))',
                        color: isDone ? '#10b981' : task.status === 'in_progress' ? '#3b82f6' : 'var(--text-muted)',
                      }}
                    >
                      {isDone ? 'Completed' : task.status === 'in_progress' ? 'In Progress' : 'Not Completed'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Task Create/Edit Modal ── */}
      <FocusTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        taskToEdit={editingTask}
        defaultDate={today}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </div>
  );
}

export default PandoraTimerPage;
