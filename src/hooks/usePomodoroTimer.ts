/**
 * usePomodoroTimer.ts
 * ─────────────────────────────────────────────────────────────
 * Authoritative timestamp-based Pomodoro timer engine.
 *
 * Guarantees:
 * 1. Elapsed time is calculated using timestamps, completely immune to
 *    browser tab throttling, minimization, and device sleep.
 * 2. Continuous repeating alarm until explicitly stopped by user.
 * 3. Exact active-time accounting (no pause time, no alarm ringing time).
 * 4. Full local persistence across refreshes & tab closes.
 * 5. Supabase session synchronization with idempotent records.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PomodoroPhase,
  PomodoroTimerStatus,
  PomodoroSettings,
  PomodoroSession,
} from '../types/pomodoro.types';
import {
  pomodoroService,
  DEFAULT_SETTINGS,
} from '../services/pomodoro.service';
import { audioAlert } from '../utils/audioAlert';
import {
  showPomodoroNotification,
  getNotificationPermission,
  requestNotificationPermission,
} from '../utils/pomodoroNotifications';

export interface UsePomodoroTimerProps {
  userId?: string;
  selectedSubjectId?: string;
  selectedChapterId?: string;
  selectedTopicId?: string;
  topicName?: string;
  onSessionSaved?: () => void;
}

export function usePomodoroTimer({
  userId,
  selectedSubjectId,
  selectedChapterId,
  selectedTopicId,
  topicName,
  onSessionSaved,
}: UsePomodoroTimerProps) {
  // ─── Settings ───────────────────────────────────────────────
  const [settings, setSettings] = useState<PomodoroSettings>(() =>
    pomodoroService.getSettings()
  );

  // ─── Core Timer State ───────────────────────────────────────
  const [phase, setPhase] = useState<PomodoroPhase>('focus');
  const [status, setStatus] = useState<PomodoroTimerStatus>('idle');
  const [cycleNumber, setCycleNumber] = useState(1);
  const [remainingSeconds, setRemainingSeconds] = useState(
    settings.focusDurationMinutes * 60
  );

  // Tracking active DB session
  const [activeSession, setActiveSession] = useState<PomodoroSession | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission()
  );

  // ─── Timekeeping Refs (Source of Truth) ─────────────────────
  const phaseEndTimeRef = useRef<number | null>(null);
  const phaseStartTimeRef = useRef<number | null>(null);
  const currentSegmentStartRef = useRef<number | null>(null);

  // Accumulated active run seconds (excluding pauses and alarm)
  const accumulatedFocusSecondsRef = useRef<number>(0);
  const accumulatedBreakSecondsRef = useRef<number>(0);
  const plannedDurationSecondsRef = useRef<number>(settings.focusDurationMinutes * 60);

  // Active interval & alarm refs
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalDocTitleRef = useRef<string>(
    typeof document !== 'undefined' ? document.title : 'StudySpace'
  );
  const titleFlashTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Helper: Get Phase Duration in Seconds ──────────────────
  const getPhaseDurationSeconds = useCallback(
    (p: PomodoroPhase, cycle: number, currentSettings: PomodoroSettings): number => {
      if (p === 'focus') {
        return Math.max(1, currentSettings.focusDurationMinutes * 60);
      }
      if (p === 'short_break') {
        return Math.max(1, currentSettings.shortBreakDurationMinutes * 60);
      }
      if (p === 'long_break') {
        return Math.max(1, currentSettings.longBreakDurationMinutes * 60);
      }
      return 25 * 60;
    },
    []
  );

  // Determine next phase
  const getNextScheduledPhase = useCallback(
    (currentPhase: PomodoroPhase, cycle: number): PomodoroPhase => {
      if (currentPhase === 'focus') {
        const isLongBreak = cycle % settings.longBreakInterval === 0;
        return isLongBreak ? 'long_break' : 'short_break';
      }
      return 'focus';
    },
    [settings.longBreakInterval]
  );

  // ─── Title Flashing ─────────────────────────────────────────
  const startTitleFlashing = useCallback((message: string) => {
    if (titleFlashTimerRef.current) clearInterval(titleFlashTimerRef.current);
    originalDocTitleRef.current = document.title;
    let flip = false;
    titleFlashTimerRef.current = setInterval(() => {
      flip = !flip;
      document.title = flip ? `⏰ ${message}` : originalDocTitleRef.current;
    }, 750);
  }, []);

  const stopTitleFlashing = useCallback(() => {
    if (titleFlashTimerRef.current) {
      clearInterval(titleFlashTimerRef.current);
      titleFlashTimerRef.current = null;
    }
    document.title = originalDocTitleRef.current;
  }, []);

  // ─── Update Settings ────────────────────────────────────────
  const updateSettings = useCallback(
    (newSettings: Partial<PomodoroSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newSettings };
        pomodoroService.saveSettings(updated);
        audioAlert.setVolume(updated.alarmVolume);

        // If currently idle, adjust remaining time to match current phase
        if (status === 'idle') {
          const dur = getPhaseDurationSeconds(phase, cycleNumber, updated);
          plannedDurationSecondsRef.current = dur;
          setRemainingSeconds(dur);
        }
        return updated;
      });
    },
    [status, phase, cycleNumber, getPhaseDurationSeconds]
  );

  // ─── Save Current Local State ───────────────────────────────
  const persistState = useCallback(
    (overrideStatus?: PomodoroTimerStatus, overrideRemaining?: number) => {
      const currentStatus = overrideStatus ?? status;
      const currentRem = overrideRemaining ?? remainingSeconds;

      if (currentStatus === 'idle') {
        pomodoroService.clearLocalState();
        return;
      }

      pomodoroService.saveLocalState({
        sessionId: activeSession?.id ?? null,
        phase,
        status: currentStatus,
        cycleNumber,
        phaseStartTime: phaseStartTimeRef.current,
        phaseEndTime: phaseEndTimeRef.current,
        plannedDurationSeconds: plannedDurationSecondsRef.current,
        remainingSeconds: currentRem,
        accumulatedFocusSeconds: accumulatedFocusSecondsRef.current,
        accumulatedBreakSeconds: accumulatedBreakSecondsRef.current,
        currentRunStartTimestamp: currentSegmentStartRef.current,
        subjectId: selectedSubjectId || null,
        chapterId: selectedChapterId || null,
        topicId: selectedTopicId || null,
        lastActiveTimestamp: Date.now(),
      });
    },
    [
      status,
      remainingSeconds,
      activeSession,
      phase,
      cycleNumber,
      selectedSubjectId,
      selectedChapterId,
      selectedTopicId,
    ]
  );

  // ─── Stop & Clear Active Alarm ──────────────────────────────
  const stopAlarm = useCallback(() => {
    audioAlert.stopAlarm();
    stopTitleFlashing();

    if (status === 'alarm') {
      const nextPhase = getNextScheduledPhase(phase, cycleNumber);
      const nextCycle = phase !== 'focus' ? cycleNumber + 1 : cycleNumber;

      const dur = getPhaseDurationSeconds(nextPhase, nextCycle, settings);
      plannedDurationSecondsRef.current = dur;
      setPhase(nextPhase);
      setCycleNumber(nextCycle);
      setRemainingSeconds(dur);
      setStatus('idle');
      phaseEndTimeRef.current = null;
      phaseStartTimeRef.current = null;
      currentSegmentStartRef.current = null;

      pomodoroService.clearLocalState();

      if (settings.autoTransition) {
        // Auto-start next phase
        setTimeout(() => {
          handleStart(nextPhase, nextCycle);
        }, 100);
      }
    }
  }, [
    status,
    phase,
    cycleNumber,
    settings,
    getNextScheduledPhase,
    getPhaseDurationSeconds,
    stopTitleFlashing,
  ]);

  // ─── Complete Phase & Trigger Alarm ─────────────────────────
  const handlePhaseComplete = useCallback(async () => {
    // 1. Clear countdown interval
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }

    // 2. Compute final segment active time up to the planned end
    if (currentSegmentStartRef.current && phaseEndTimeRef.current) {
      const elapsedSegment = Math.min(
        plannedDurationSecondsRef.current,
        Math.max(
          0,
          Math.floor((phaseEndTimeRef.current - currentSegmentStartRef.current) / 1000)
        )
      );
      if (phase === 'focus') {
        accumulatedFocusSecondsRef.current += elapsedSegment;
      } else {
        accumulatedBreakSecondsRef.current += elapsedSegment;
      }
      currentSegmentStartRef.current = null;
    }

    setStatus('alarm');
    setRemainingSeconds(0);
    phaseEndTimeRef.current = null;

    // 3. Audio & Notification Alerts
    audioAlert.startAlarm(settings.alarmVolume);

    const isFocus = phase === 'focus';
    const notifTitle = isFocus ? '🍅 Focus Session Complete!' : '☕ Break Time Ended!';
    const notifBody = isFocus
      ? topicName
        ? `Great job focusing on "${topicName}"! Time for a refreshing break.`
        : 'Awesome work! Take a breath and relax.'
      : 'Ready to dive back into your studies? Let’s focus!';

    startTitleFlashing(isFocus ? 'Focus Complete!' : 'Break Finished!');

    if (settings.browserNotifications) {
      showPomodoroNotification({
        title: notifTitle,
        body: notifBody,
        onClick: () => {
          stopAlarm();
        },
      });
    }

    // 4. Supabase DB Checkpoint / Completion
    if (activeSession) {
      if (isFocus) {
        // Focus phase completed -> record checkpoint with completed focus time
        await pomodoroService.checkpointSession(activeSession.id, {
          actual_focus_seconds: accumulatedFocusSecondsRef.current,
          current_phase: 'focus',
        });
      } else {
        // Break completed -> Whole Pomodoro cycle is complete!
        await pomodoroService.completeSession(
          activeSession.id,
          accumulatedFocusSecondsRef.current,
          accumulatedBreakSecondsRef.current,
          {
            userId,
            subjectId: selectedSubjectId,
            chapterId: selectedChapterId,
            topicId: selectedTopicId,
          }
        );
        setActiveSession(null);
        if (onSessionSaved) onSessionSaved();
      }
    }

    persistState('alarm', 0);
  }, [
    phase,
    settings,
    topicName,
    activeSession,
    userId,
    selectedSubjectId,
    selectedChapterId,
    selectedTopicId,
    startTitleFlashing,
    stopAlarm,
    onSessionSaved,
    persistState,
  ]);

  // ─── Authoritative Time Tick Handler ────────────────────────
  const checkTimeProgression = useCallback(() => {
    if (status !== 'running' || !phaseEndTimeRef.current) return;

    const now = Date.now();
    const remainingMs = phaseEndTimeRef.current - now;
    const remaining = Math.max(0, Math.ceil(remainingMs / 1000));

    setRemainingSeconds(remaining);

    if (remainingMs <= 0) {
      handlePhaseComplete();
    }
  }, [status, handlePhaseComplete]);

  // ─── Set Up Interval For Countdown ──────────────────────────
  useEffect(() => {
    if (status !== 'running') {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      return;
    }

    checkTimeProgression();
    tickIntervalRef.current = setInterval(checkTimeProgression, 200);

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [status, checkTimeProgression]);

  // ─── Background / Visibility / Sleep Recovery ───────────────
  useEffect(() => {
    const handleVisibilityOrFocusChange = () => {
      if (status === 'running' && phaseEndTimeRef.current) {
        checkTimeProgression();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocusChange);
    window.addEventListener('focus', handleVisibilityOrFocusChange);
    window.addEventListener('pageshow', handleVisibilityOrFocusChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocusChange);
      window.removeEventListener('focus', handleVisibilityOrFocusChange);
      window.removeEventListener('pageshow', handleVisibilityOrFocusChange);
    };
  }, [status, checkTimeProgression]);

  // ─── Start / Resume Handler ─────────────────────────────────
  const handleStart = async (
    targetPhase?: PomodoroPhase,
    targetCycle?: number
  ) => {
    // Unlock Web Audio API on user gesture
    audioAlert.init();

    const currPhase = targetPhase || phase;
    const currCycle = targetCycle || cycleNumber;

    if (status === 'paused') {
      // ── Resume ──
      const now = Date.now();
      phaseEndTimeRef.current = now + remainingSeconds * 1000;
      currentSegmentStartRef.current = now;
      setStatus('running');
      persistState('running');
      return;
    }

    // ── Fresh Start ──
    const durSeconds = getPhaseDurationSeconds(currPhase, currCycle, settings);
    plannedDurationSecondsRef.current = durSeconds;
    setRemainingSeconds(durSeconds);

    const now = Date.now();
    phaseStartTimeRef.current = now;
    phaseEndTimeRef.current = now + durSeconds * 1000;
    currentSegmentStartRef.current = now;

    // If starting a fresh focus phase, create new Supabase session
    if (currPhase === 'focus' && userId) {
      accumulatedFocusSecondsRef.current = 0;
      accumulatedBreakSecondsRef.current = 0;

      const plannedBreak = getPhaseDurationSeconds(
        getNextScheduledPhase('focus', currCycle),
        currCycle,
        settings
      );

      try {
        const session = await pomodoroService.startSession(userId, {
          plannedFocusSeconds: durSeconds,
          plannedBreakSeconds: plannedBreak,
          cycleNumber: currCycle,
          subjectId: selectedSubjectId,
          chapterId: selectedChapterId,
          topicId: selectedTopicId,
        });
        setActiveSession(session);
      } catch (err) {
        console.warn('Could not record initial session in DB:', err);
      }
    } else if (activeSession) {
      // Transitioning into break
      await pomodoroService.checkpointSession(activeSession.id, {
        current_phase: currPhase,
        planned_break_seconds: durSeconds,
      });
    }

    setStatus('running');
    persistState('running', durSeconds);
  };

  // ─── Pause Handler ──────────────────────────────────────────
  const handlePause = async () => {
    if (status !== 'running') return;

    // Accumulate elapsed active time up to pause
    if (currentSegmentStartRef.current) {
      const elapsedSegment = Math.max(
        0,
        Math.floor((Date.now() - currentSegmentStartRef.current) / 1000)
      );
      if (phase === 'focus') {
        accumulatedFocusSecondsRef.current += elapsedSegment;
      } else {
        accumulatedBreakSecondsRef.current += elapsedSegment;
      }
      currentSegmentStartRef.current = null;
    }

    setStatus('paused');
    phaseEndTimeRef.current = null;

    if (activeSession) {
      pomodoroService.checkpointSession(activeSession.id, {
        actual_focus_seconds: accumulatedFocusSecondsRef.current,
        actual_break_seconds: accumulatedBreakSecondsRef.current,
      });
    }

    persistState('paused');
  };

  // ─── Reset / Interrupted Session Confirmation ───────────────
  const requestReset = () => {
    if (status === 'running' || status === 'paused') {
      setIsConfirmingReset(true);
    } else if (status === 'alarm') {
      stopAlarm();
    } else {
      // Idle reset
      const dur = getPhaseDurationSeconds(phase, cycleNumber, settings);
      setRemainingSeconds(dur);
    }
  };

  const confirmReset = async () => {
    setIsConfirmingReset(false);

    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    stopAlarm();

    // Compute actual time accumulated so far before terminating
    if (currentSegmentStartRef.current) {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - currentSegmentStartRef.current) / 1000)
      );
      if (phase === 'focus') {
        accumulatedFocusSecondsRef.current += elapsed;
      } else {
        accumulatedBreakSecondsRef.current += elapsed;
      }
      currentSegmentStartRef.current = null;
    }

    // Mark in Supabase as interrupted so partial work is preserved!
    if (activeSession) {
      await pomodoroService.interruptSession(
        activeSession.id,
        accumulatedFocusSecondsRef.current,
        accumulatedBreakSecondsRef.current,
        {
          userId,
          subjectId: selectedSubjectId,
          chapterId: selectedChapterId,
          topicId: selectedTopicId,
        }
      );
      setActiveSession(null);
      if (onSessionSaved) onSessionSaved();
    }

    // Reset local state to idle
    const dur = getPhaseDurationSeconds('focus', cycleNumber, settings);
    setPhase('focus');
    setStatus('idle');
    setRemainingSeconds(dur);
    plannedDurationSecondsRef.current = dur;
    phaseEndTimeRef.current = null;
    phaseStartTimeRef.current = null;
    accumulatedFocusSecondsRef.current = 0;
    accumulatedBreakSecondsRef.current = 0;

    pomodoroService.clearLocalState();
  };

  const cancelReset = () => {
    setIsConfirmingReset(false);
  };

  // ─── Skip Current Phase ─────────────────────────────────────
  const handleSkipPhase = async () => {
    if (status === 'running' || status === 'paused') {
      // Credit active time so far
      if (currentSegmentStartRef.current) {
        const elapsed = Math.max(
          0,
          Math.floor((Date.now() - currentSegmentStartRef.current) / 1000)
        );
        if (phase === 'focus') {
          accumulatedFocusSecondsRef.current += elapsed;
        } else {
          accumulatedBreakSecondsRef.current += elapsed;
        }
        currentSegmentStartRef.current = null;
      }

      if (activeSession) {
        await pomodoroService.interruptSession(
          activeSession.id,
          accumulatedFocusSecondsRef.current,
          accumulatedBreakSecondsRef.current,
          {
            userId,
            subjectId: selectedSubjectId,
            chapterId: selectedChapterId,
            topicId: selectedTopicId,
          }
        );
        setActiveSession(null);
        if (onSessionSaved) onSessionSaved();
      }
    }

    stopAlarm();

    const nextPhase = getNextScheduledPhase(phase, cycleNumber);
    const nextCycle = phase !== 'focus' ? cycleNumber + 1 : cycleNumber;
    const dur = getPhaseDurationSeconds(nextPhase, nextCycle, settings);

    setPhase(nextPhase);
    setCycleNumber(nextCycle);
    setRemainingSeconds(dur);
    setStatus('idle');
    plannedDurationSecondsRef.current = dur;
    phaseEndTimeRef.current = null;
    phaseStartTimeRef.current = null;
    accumulatedFocusSecondsRef.current = 0;
    accumulatedBreakSecondsRef.current = 0;

    pomodoroService.clearLocalState();
  };

  // ─── Select Phase Directly When Idle ────────────────────────
  const selectPhase = (newPhase: PomodoroPhase) => {
    if (status !== 'idle') return;
    setPhase(newPhase);
    const dur = getPhaseDurationSeconds(newPhase, cycleNumber, settings);
    plannedDurationSecondsRef.current = dur;
    setRemainingSeconds(dur);
  };

  // ─── Notification Permission Request ────────────────────────
  const requestNotification = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      updateSettings({ browserNotifications: true });
    }
  };

  // ─── Restore Saved State on Mount ───────────────────────────
  useEffect(() => {
    const saved = pomodoroService.getLocalState();
    if (!saved) return;

    setPhase(saved.phase);
    setCycleNumber(saved.cycleNumber);
    plannedDurationSecondsRef.current = saved.plannedDurationSeconds;
    accumulatedFocusSecondsRef.current = saved.accumulatedFocusSeconds || 0;
    accumulatedBreakSecondsRef.current = saved.accumulatedBreakSeconds || 0;

    if (saved.sessionId) {
      setActiveSession({
        id: saved.sessionId,
        user_id: userId || '',
        started_at: new Date(saved.phaseStartTime || Date.now()).toISOString(),
        ended_at: null,
        planned_focus_seconds: saved.plannedDurationSeconds,
        planned_break_seconds: 0,
        actual_focus_seconds: saved.accumulatedFocusSeconds,
        actual_break_seconds: saved.accumulatedBreakSeconds,
        session_status: 'in_progress',
        current_phase: saved.phase,
        cycle_number: saved.cycleNumber,
        subject_id: saved.subjectId,
        chapter_id: saved.chapterId,
        topic_id: saved.topicId,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (saved.status === 'running' && saved.phaseEndTime) {
      const now = Date.now();
      const left = Math.ceil((saved.phaseEndTime - now) / 1000);

      if (left <= 0) {
        // Expired while tab was closed/suspended!
        setStatus('alarm');
        setRemainingSeconds(0);
        audioAlert.startAlarm(settings.alarmVolume);
        startTitleFlashing('Phase Complete!');
      } else {
        // Still running!
        phaseEndTimeRef.current = saved.phaseEndTime;
        phaseStartTimeRef.current = saved.phaseStartTime;
        currentSegmentStartRef.current = now;
        setStatus('running');
        setRemainingSeconds(left);
      }
    } else if (saved.status === 'paused') {
      setStatus('paused');
      setRemainingSeconds(saved.remainingSeconds);
    } else if (saved.status === 'alarm') {
      setStatus('alarm');
      setRemainingSeconds(0);
      audioAlert.startAlarm(settings.alarmVolume);
      startTitleFlashing('Phase Complete!');
    }
  }, []); // Run once on mount

  // ─── Cleanup on Unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      audioAlert.stopAlarm();
      stopTitleFlashing();
    };
  }, [stopTitleFlashing]);

  return {
    phase,
    status,
    cycleNumber,
    remainingSeconds,
    plannedDurationSeconds: plannedDurationSecondsRef.current,
    settings,
    activeSession,
    isConfirmingReset,
    notifPermission,
    nextPhase: getNextScheduledPhase(phase, cycleNumber),
    handleStart: () => handleStart(),
    handlePause,
    handleResume: () => handleStart(),
    requestReset,
    confirmReset,
    cancelReset,
    handleSkipPhase,
    stopAlarm,
    selectPhase,
    updateSettings,
    requestNotification,
  };
}
