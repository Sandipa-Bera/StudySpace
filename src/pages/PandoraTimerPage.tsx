import { useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  BellOff,
  Brain,
  Coffee,
  Sparkles,
  Settings,
  Bell,
  Sprout,
  BarChart3,
  Flame,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { subjectsService } from '../services/subjects.service';
import { chaptersService } from '../services/chapters.service';
import { topicsService } from '../services/topics.service';
import { focusSessionsService, type FocusStats } from '../services/focusSessions.service';
import { FocusGarden } from '../components/ui/FocusGarden';
import { TimerDisplay } from '../components/pomodoro/TimerDisplay';
import { PomodoroSettingsModal } from '../components/pomodoro/PomodoroSettingsModal';
import { ResetConfirmModal } from '../components/pomodoro/ResetConfirmModal';
import { PomodoroHistory } from '../components/pomodoro/PomodoroHistory';
import { usePomodoroTimer } from '../hooks/usePomodoroTimer';
import type { Subject, Chapter, Topic } from '../types';

export function PandoraTimerPage() {
  const { user } = useAuth();

  // ─── Curriculum Selection (Optional context for focus) ───
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');

  // ─── Active Dashboard Tab (History vs Garden) ────────────
  const [activeTab, setActiveTab] = useState<'analytics' | 'garden'>('analytics');

  // ─── Modal States ─────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

  // ─── Focus Garden Compatibility ───────────────────────────
  const [gardenStats, setGardenStats] = useState<FocusStats | null>(null);
  const [gardenLoading, setGardenLoading] = useState(false);
  const [justCompletedGarden, setJustCompletedGarden] = useState(false);
  const [prevTotalSeconds, setPrevTotalSeconds] = useState(0);

  // ─── Format Today's Date ──────────────────────────────────
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  // ─── Load Subjects ───────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    subjectsService.getAll(user.id).then(setSubjects).catch(console.error);
  }, [user]);

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedChapterId('');
    setSelectedTopicId('');
    if (subjectId) {
      chaptersService.getBySubject(subjectId).then(setChapters).catch(console.error);
    } else {
      setChapters([]);
      setTopics([]);
    }
  };

  const handleChapterChange = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setSelectedTopicId('');
    if (chapterId) {
      topicsService.getByChapter(chapterId).then(setTopics).catch(console.error);
    } else {
      setTopics([]);
    }
  };

  // ─── Refresh Focus Garden stats ──────────────────────────
  const refreshGardenStats = useCallback(async () => {
    if (!user) return;
    try {
      setGardenLoading(true);
      const stats = await focusSessionsService.getFocusStats(user.id);
      setGardenStats(stats);
      setPrevTotalSeconds(stats.total_seconds);
    } catch (err) {
      console.warn('Failed to refresh garden stats:', err);
    } finally {
      setGardenLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === 'garden') {
      refreshGardenStats();
    }
  }, [user, activeTab, refreshGardenStats]);

  // Selected names for target pill
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);
  const selectedTopic = topics.find((t) => t.id === selectedTopicId);

  // ─── Pomodoro Timer Hook ─────────────────────────────────
  const {
    phase,
    status,
    cycleNumber,
    remainingSeconds,
    plannedDurationSeconds,
    settings,
    isConfirmingReset,
    notifPermission,
    nextPhase,
    handleStart,
    handlePause,
    handleResume,
    requestReset,
    confirmReset,
    cancelReset,
    handleSkipPhase,
    stopAlarm,
    selectPhase,
    updateSettings,
    requestNotification,
  } = usePomodoroTimer({
    userId: user?.id,
    selectedSubjectId: selectedSubjectId || undefined,
    selectedChapterId: selectedChapterId || undefined,
    selectedTopicId: selectedTopicId || undefined,
    topicName: selectedTopic?.name || selectedChapter?.name,
    onSessionSaved: () => {
      setHistoryRefreshTrigger((prev) => prev + 1);
      refreshGardenStats();
      setJustCompletedGarden(true);
    },
  });

  // ─── Keyboard Hotkeys (Space for Play/Pause, Esc to dismiss modal) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept hotkeys if user is in an input or select
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (status === 'alarm') {
          stopAlarm();
        } else if (status === 'running') {
          handlePause();
        } else if (status === 'paused') {
          handleResume();
        } else if (status === 'idle') {
          handleStart();
        }
      } else if (e.code === 'Escape') {
        if (isConfirmingReset) {
          cancelReset();
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, isConfirmingReset, isSettingsOpen, handleStart, handlePause, handleResume, stopAlarm, cancelReset]);

  const nextPhaseDurationMinutes =
    nextPhase === 'focus'
      ? settings.focusDurationMinutes
      : nextPhase === 'short_break'
      ? settings.shortBreakDurationMinutes
      : settings.longBreakDurationMinutes;

  const accumulatedMinutes = Math.max(
    0,
    Math.floor((plannedDurationSeconds - remainingSeconds) / 60)
  );

  return (
    <div className="pomo-dashboard-page">
      {/* ── Dashboard Header ── */}
      <div className="pomo-dashboard-header">
        <div className="pomo-header-left">
          <div className="pomo-date-pill">
            <Calendar className="w-3.5 h-3.5 text-secondary" />
            <span>{todayFormatted}</span>
          </div>
          <h1 className="pomo-main-title">
            <span>Focus</span> Command Center
          </h1>
          <p className="pomo-header-subtitle">
            Reliable time tracking, balanced breaks, and real-time productivity analytics
          </p>
        </div>

        <div className="pomo-header-actions">
          {notifPermission === 'default' && (
            <button
              className="pomo-settings-trigger-btn pomo-notif-cta"
              onClick={requestNotification}
              title="Enable desktop notifications"
              aria-label="Allow desktop notifications"
            >
              <Bell className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>Allow Notifications</span>
            </button>
          )}

          <button
            className="pomo-settings-trigger-btn"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open timer settings"
          >
            <Settings className="w-4 h-4" />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {/* ── Mode Selector Tabs (Focus / Short Break / Long Break) ── */}
      <div className="pomo-mode-selector-wrap">
        <div className="pomo-mode-selector" role="tablist" aria-label="Pomodoro Phase Modes">
          <button
            role="tab"
            aria-selected={phase === 'focus'}
            className={`pomo-mode-tab ${phase === 'focus' ? 'active-focus' : ''}`}
            onClick={() => selectPhase('focus')}
            disabled={status !== 'idle'}
          >
            <Brain className="w-4 h-4" />
            <span>Focus ({settings.focusDurationMinutes}m)</span>
          </button>

          <button
            role="tab"
            aria-selected={phase === 'short_break'}
            className={`pomo-mode-tab ${
              phase === 'short_break' ? 'active-short-break' : ''
            }`}
            onClick={() => selectPhase('short_break')}
            disabled={status !== 'idle'}
          >
            <Coffee className="w-4 h-4" />
            <span>Short Break ({settings.shortBreakDurationMinutes}m)</span>
          </button>

          <button
            role="tab"
            aria-selected={phase === 'long_break'}
            className={`pomo-mode-tab ${
              phase === 'long_break' ? 'active-long-break' : ''
            }`}
            onClick={() => selectPhase('long_break')}
            disabled={status !== 'idle'}
          >
            <Sparkles className="w-4 h-4" />
            <span>Long Break ({settings.longBreakDurationMinutes}m)</span>
          </button>
        </div>
      </div>

      {/* ── Alarm Ringing Notification Banner ── */}
      {status === 'alarm' && (
        <div className="pomo-alarm-banner" role="alert">
          <div className="pomo-alarm-banner-left">
            <span className="pomo-alarm-banner-icon" aria-hidden="true">🔔</span>
            <div>
              <h3 className="pomo-alarm-banner-title">
                {phase === 'focus'
                  ? 'Focus Countdown Complete! Take a well-deserved break.'
                  : 'Break Time is over! Ready to return to studying?'}
              </h3>
              <p className="pomo-alarm-banner-desc">
                Alarm is repeating continuously. Click below or press Space to stop it.
              </p>
            </div>
          </div>
          <button
            className="pomo-main-action-btn btn-alarm"
            onClick={stopAlarm}
            autoFocus
          >
            <BellOff className="w-4 h-4" /> Stop Alarm
          </button>
        </div>
      )}

      {/* ── Optional Curriculum Linking (Subject/Chapter/Topic) ── */}
      {status === 'idle' && (
        <div className="pomo-curriculum-panel">
          <div className="pomo-curriculum-grid">
            <div className="pomo-curriculum-field">
              <label htmlFor="pomo-select-subject">Link Subject (Optional)</label>
              <select
                id="pomo-select-subject"
                className="pomo-curriculum-select"
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
              >
                <option value="">— No Subject —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pomo-curriculum-field">
              <label htmlFor="pomo-select-chapter">Chapter</label>
              <select
                id="pomo-select-chapter"
                className="pomo-curriculum-select"
                value={selectedChapterId}
                onChange={(e) => handleChapterChange(e.target.value)}
                disabled={!selectedSubjectId}
              >
                <option value="">— Select Chapter —</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pomo-curriculum-field">
              <label htmlFor="pomo-select-topic">Topic</label>
              <select
                id="pomo-select-topic"
                className="pomo-curriculum-select"
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                disabled={!selectedChapterId}
              >
                <option value="">— Select Topic —</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Circular Timer Display ── */}
      <TimerDisplay
        phase={phase}
        status={status}
        remainingSeconds={remainingSeconds}
        totalDurationSeconds={plannedDurationSeconds}
        cycleNumber={cycleNumber}
        maxCycle={settings.longBreakInterval}
        nextPhase={nextPhase}
        nextDurationMinutes={nextPhaseDurationMinutes}
        subjectName={selectedSubject?.name}
        chapterName={selectedChapter?.name}
        topicName={selectedTopic?.name}
      />

      {/* ── Timer Controls ── */}
      <div className="pomo-controls-container">
        {status === 'idle' && (
          <button
            className={`pomo-main-action-btn ${
              phase === 'focus' ? 'btn-focus' : 'btn-break'
            }`}
            onClick={handleStart}
            title="Press Space to start"
            aria-label={phase === 'focus' ? 'Start Focus' : 'Start Break'}
          >
            <Play className="w-5 h-5 fill-current" />
            <span>
              {phase === 'focus' ? 'Start Focus' : 'Start Break'}
            </span>
          </button>
        )}

        {status === 'running' && (
          <>
            <button
              className="pomo-sub-action-btn btn-pause"
              onClick={handlePause}
              title="Pause Timer (Space)"
              aria-label="Pause Timer"
            >
              <Pause className="w-4 h-4" /> Pause
            </button>
            <button
              className="pomo-sub-action-btn"
              onClick={requestReset}
              title="Reset Timer"
              aria-label="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button
              className="pomo-sub-action-btn"
              onClick={handleSkipPhase}
              title="Skip to next phase"
              aria-label="Skip to next phase"
            >
              <SkipForward className="w-4 h-4" /> Skip
            </button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button
              className={`pomo-main-action-btn ${
                phase === 'focus' ? 'btn-focus' : 'btn-break'
              }`}
              onClick={handleResume}
              title="Resume Timer (Space)"
              aria-label="Resume Timer"
            >
              <Play className="w-5 h-5 fill-current" /> Resume
            </button>
            <button
              className="pomo-sub-action-btn"
              onClick={requestReset}
              aria-label="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button
              className="pomo-sub-action-btn"
              onClick={handleSkipPhase}
              aria-label="Skip Phase"
            >
              <SkipForward className="w-4 h-4" /> Skip
            </button>
          </>
        )}

        {status === 'alarm' && (
          <button
            className="pomo-main-action-btn btn-alarm"
            onClick={stopAlarm}
            title="Stop Alarm (Space)"
            aria-label="Stop Alarm"
          >
            <BellOff className="w-5 h-5" /> Stop Alarm & Continue
          </button>
        )}
      </div>

      <div className="pomo-keyboard-hint">
        <span>Keyboard shortcut: press <strong>Space</strong> to {status === 'running' ? 'pause' : status === 'paused' ? 'resume' : 'start'}</span>
      </div>

      {/* ── View Mode Switcher: Productivity History vs Focus Garden ── */}
      <div className="flex items-center justify-center gap-2 mb-6 mt-8">
        <button
          className={`pomo-filter-btn px-4 py-2 text-sm flex items-center gap-1.5 ${
            activeTab === 'analytics' ? 'active' : ''
          }`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Productivity History & Stats</span>
        </button>

        <button
          className={`pomo-filter-btn px-4 py-2 text-sm flex items-center gap-1.5 ${
            activeTab === 'garden' ? 'active' : ''
          }`}
          onClick={() => setActiveTab('garden')}
        >
          <Sprout className="w-4 h-4 text-emerald-500" />
          <span>Focus Garden Tree</span>
        </button>
      </div>

      {/* ── Tab Content: History & Stats vs Focus Garden ── */}
      {activeTab === 'analytics' ? (
        user && (
          <PomodoroHistory
            userId={user.id}
            refreshTrigger={historyRefreshTrigger}
            onRefreshStats={refreshGardenStats}
          />
        )
      ) : (
        <FocusGarden
          stats={gardenStats}
          loading={gardenLoading}
          justCompleted={justCompletedGarden}
          prevTotalSeconds={prevTotalSeconds}
          onJustCompletedDismiss={() => setJustCompletedGarden(false)}
        />
      )}

      {/* ── Settings Modal ── */}
      <PomodoroSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={updateSettings}
        notifPermission={notifPermission}
        onRequestNotification={requestNotification}
      />

      {/* ── Confirmation Modal Before Discarding Active Session ── */}
      <ResetConfirmModal
        isOpen={isConfirmingReset}
        onConfirm={confirmReset}
        onCancel={cancelReset}
        accumulatedMinutes={accumulatedMinutes}
      />
    </div>
  );
}

export default PandoraTimerPage;
