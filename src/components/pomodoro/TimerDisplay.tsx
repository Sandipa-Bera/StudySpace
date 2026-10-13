import { Brain, Coffee, Sparkles, BellRing, PauseCircle } from 'lucide-react';
import type { PomodoroPhase, PomodoroTimerStatus } from '../../types/pomodoro.types';

interface TimerDisplayProps {
  phase: PomodoroPhase;
  status: PomodoroTimerStatus;
  remainingSeconds: number;
  totalDurationSeconds: number;
  cycleNumber: number;
  maxCycle: number;
  nextPhase: PomodoroPhase;
  nextDurationMinutes: number;
  subjectName?: string;
  chapterName?: string;
  topicName?: string;
}

export function formatTimeMMSS(totalSecs: number): string {
  const safe = Math.max(0, Math.floor(totalSecs));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function TimerDisplay({
  phase,
  status,
  remainingSeconds,
  totalDurationSeconds,
  cycleNumber,
  maxCycle,
  nextPhase,
  nextDurationMinutes,
  subjectName,
  chapterName,
  topicName,
}: TimerDisplayProps) {
  // SVG Ring dimensions
  const size = 320;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Progress computation (1 when full, 0 when empty)
  const progress =
    totalDurationSeconds > 0
      ? Math.max(0, Math.min(1, remainingSeconds / totalDurationSeconds))
      : 0;
  const strokeDashoffset = circumference * (1 - progress);

  // Status visual cues
  const isAlarm = status === 'alarm';
  const isRunning = status === 'running';
  const isPaused = status === 'paused';

  const getPhaseConfig = () => {
    switch (phase) {
      case 'focus':
        return {
          label: 'Focus Phase',
          icon: Brain,
          badgeClass: 'pomo-badge-focus',
          strokeColor: 'url(#pomoGradientFocus)',
        };
      case 'short_break':
        return {
          label: 'Short Break',
          icon: Coffee,
          badgeClass: 'pomo-badge-short',
          strokeColor: 'url(#pomoGradientShortBreak)',
        };
      case 'long_break':
        return {
          label: 'Long Break',
          icon: Sparkles,
          badgeClass: 'pomo-badge-long',
          strokeColor: 'url(#pomoGradientLongBreak)',
        };
    }
  };

  const phaseConfig = getPhaseConfig();
  const PhaseIcon = phaseConfig.icon;

  const nextPhaseLabel =
    nextPhase === 'focus'
      ? 'Focus Session'
      : nextPhase === 'short_break'
      ? 'Short Break'
      : 'Long Break';

  const accessibleTimerLabel = `${formatTimeMMSS(remainingSeconds)} remaining in ${
    phaseConfig.label
  }. ${
    isAlarm
      ? 'Time is up! Press Stop Alarm.'
      : isRunning
      ? 'Timer is running.'
      : isPaused
      ? 'Timer is paused.'
      : 'Timer is ready.'
  }`;

  return (
    <div
      className="pomo-timer-container"
      role="timer"
      aria-label={accessibleTimerLabel}
    >
      {/* ── Cycle Progress Indicator (Dots) ── */}
      <div className="pomo-cycle-indicator" aria-label={`Cycle ${cycleNumber} of ${maxCycle}`}>
        <div className="pomo-cycle-label">
          <span>Cycle</span>
          <strong>
            #{cycleNumber} <span className="text-text-muted font-normal">of {maxCycle}</span>
          </strong>
        </div>
        <div className="pomo-cycle-dots">
          {Array.from({ length: maxCycle }).map((_, idx) => {
            const dotNumber = idx + 1;
            const isCompleted = ((cycleNumber - 1) % maxCycle) >= dotNumber;
            const isCurrent = ((cycleNumber - 1) % maxCycle) + 1 === dotNumber;
            return (
              <div
                key={dotNumber}
                className={`pomo-cycle-dot ${
                  isCompleted
                    ? 'completed'
                    : isCurrent
                    ? 'current active-pulse'
                    : 'upcoming'
                }`}
                title={`Pomodoro ${dotNumber} of ${maxCycle}`}
              />
            );
          })}
        </div>
      </div>

      {/* ── Circular Progress Ring ── */}
      <div
        className={`pomo-timer-dial ${isRunning ? 'is-running' : ''} ${
          isAlarm ? 'is-alarm' : ''
        } ${isPaused ? 'is-paused' : ''}`}
      >
        <svg
          className="pomo-dial-svg"
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
        >
          <defs>
            {/* Focus Gradient: Warm rich terracotta to vibrant violet/indigo */}
            <linearGradient id="pomoGradientFocus" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C47E79" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>

            {/* Short Break Gradient: Sage to fresh emerald */}
            <linearGradient id="pomoGradientShortBreak" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6B8E6B" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>

            {/* Long Break Gradient: Sky blue to turquoise */}
            <linearGradient id="pomoGradientLongBreak" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>

            {/* Alarm Gradient: Vibrant warning pulse */}
            <linearGradient id="pomoGradientAlarm" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>

          {/* Background track */}
          <circle
            className="pomo-dial-track"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />

          {/* Animated progress stroke */}
          <circle
            className="pomo-dial-progress"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            stroke={isAlarm ? 'url(#pomoGradientAlarm)' : phaseConfig.strokeColor}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Content */}
        <div className="pomo-dial-center">
          {/* Phase Badge */}
          <div className={`pomo-phase-badge ${phaseConfig.badgeClass}`}>
            <PhaseIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{phaseConfig.label}</span>
          </div>

          {/* Large Countdown with Tabular Digits */}
          <div className="pomo-time-number" aria-live="polite">
            {formatTimeMMSS(remainingSeconds)}
          </div>

          {/* Status state badge */}
          <div className="pomo-status-caption">
            {isAlarm && (
              <span className="pomo-status-tag pomo-status-alarm">
                <BellRing className="w-3.5 h-3.5 inline animate-bounce mr-1" aria-hidden="true" />
                Time’s Up! Press Stop
              </span>
            )}
            {isRunning && (
              <span className="pomo-status-tag pomo-status-running">
                <span className="pomo-pulse-dot" aria-hidden="true" /> Focusing actively
              </span>
            )}
            {isPaused && (
              <span className="pomo-status-tag pomo-status-paused">
                <PauseCircle className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" /> Timer Paused
              </span>
            )}
            {status === 'idle' && (
              <span className="pomo-status-tag pomo-status-idle">
                Ready to begin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Curriculum Target Card (Subject / Chapter / Topic) ── */}
      {(subjectName || chapterName || topicName) && (
        <div className="pomo-target-pill" title="Linked Study Target">
          {subjectName && <span className="pomo-target-subject">📚 {subjectName}</span>}
          {chapterName && <span className="pomo-target-sep">›</span>}
          {chapterName && <span className="pomo-target-chapter">📖 {chapterName}</span>}
          {topicName && <span className="pomo-target-sep">›</span>}
          {topicName && <span className="pomo-target-topic">🏷️ {topicName}</span>}
        </div>
      )}

      {/* ── Next Phase Foresight ── */}
      <div className="pomo-next-phase-hint">
        <span className="text-text-muted">Next Up:</span>{' '}
        <span className="font-semibold text-text">
          {nextPhaseLabel} ({nextDurationMinutes}m)
        </span>
      </div>
    </div>
  );
}
