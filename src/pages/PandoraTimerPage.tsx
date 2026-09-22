import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  BellOff,
  Coffee,
  Brain,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { subjectsService } from '../services/subjects.service';
import { chaptersService } from '../services/chapters.service';
import { topicsService } from '../services/topics.service';
import type { Subject, Chapter, Topic } from '../types';

// ─── Quick-pick durations ─────────────────────────────────
const QUICK_PICKS = [
  { label: '5m', minutes: 5 },
  { label: '10m', minutes: 10 },
  { label: '15m', minutes: 15 },
  { label: '25m', minutes: 25 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '60m', minutes: 60 },
];

type TimerStatus = 'idle' | 'running' | 'paused' | 'done';
type TimerMode = 'focus' | 'break';

// ─── Web Audio beep generator ─────────────────────────────
function createBeepLoop(audioCtx: AudioContext): { start: () => void; stop: () => void } {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let currentOsc: OscillatorNode | null = null;

  const beepOnce = () => {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.3);
      currentOsc = osc;
    } catch {
      // Audio context may be closed
    }
  };

  return {
    start: () => {
      beepOnce();
      intervalId = setInterval(beepOnce, 700);
    },
    stop: () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
      if (currentOsc) {
        try { currentOsc.stop(); } catch { /* already stopped */ }
        currentOsc = null;
      }
    },
  };
}

// ─── Utility: format seconds to MM:SS ─────────────────────
function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════
export function PandoraTimerPage() {
  const { user } = useAuth();

  // ─── Data state ─────────────────────────────────────────
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');

  // ─── Timer state ────────────────────────────────────────
  const [mode, setMode] = useState<TimerMode>('focus');
  const [durationMinutes, setDurationMinutes] = useState(25); // 25 min default
  const [remaining, setRemaining] = useState(25 * 60); // in seconds internally
  const [status, setStatus] = useState<TimerStatus>('idle');

  // Absolute end-time ref (for sleep/background reliability)
  const endTimeRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Audio refs ─────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  // ─── Title flash ref ────────────────────────────────────
  const originalTitleRef = useRef(document.title);
  const titleFlashRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Notification permission ────────────────────────────
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // ─── Derived: duration in seconds ───────────────────────
  const durationSeconds = durationMinutes * 60;

  // ─── Load subjects ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    subjectsService.getAll(user.id).then(setSubjects).catch(console.error);
  }, [user]);

  // ─── Load chapters when subject changes ────────────────
  useEffect(() => {
    if (!selectedSubjectId) { setChapters([]); setSelectedChapterId(''); return; }
    chaptersService.getBySubject(selectedSubjectId).then(setChapters).catch(console.error);
    setSelectedChapterId('');
    setSelectedTopicId('');
  }, [selectedSubjectId]);

  // ─── Load topics when chapter changes ──────────────────
  useEffect(() => {
    if (!selectedChapterId) { setTopics([]); setSelectedTopicId(''); return; }
    topicsService.getByChapter(selectedChapterId).then(setTopics).catch(console.error);
    setSelectedTopicId('');
  }, [selectedChapterId]);

  // ─── Resolve names for display ──────────────────────────
  const selectedChapterName = chapters.find(c => c.id === selectedChapterId)?.name;
  const selectedTopicName = topics.find(t => t.id === selectedTopicId)?.name;

  // ─── Timer completion handler ───────────────────────────
  const handleTimerComplete = useCallback(() => {
    setStatus('done');
    setRemaining(0);
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }

    // Beep alarm
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const beep = createBeepLoop(audioCtxRef.current);
    beepRef.current = beep;
    beep.start();

    // Browser notification
    if (Notification.permission === 'granted') {
      try {
        new Notification('⏰ Pandora Timer Complete!', {
          body: selectedTopicName
            ? `Time to review: ${selectedTopicName}`
            : mode === 'focus' ? 'Focus session complete!' : 'Break is over!',
          icon: '/favicon.ico',
          requireInteraction: true,
        });
      } catch { /* notification not supported in some contexts */ }
    }

    // Title flash
    originalTitleRef.current = document.title;
    let flip = false;
    titleFlashRef.current = setInterval(() => {
      flip = !flip;
      document.title = flip ? '⏰ Timer Done!' : originalTitleRef.current;
    }, 800);
  }, [mode, selectedTopicName]);

  // ─── Timer tick (absolute-time based) ───────────────────
  useEffect(() => {
    if (status !== 'running') return;

    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      setRemaining(left);
      if (left <= 0) {
        handleTimerComplete();
      }
    };

    // Tick immediately, then every 250ms (fast enough for display, resilient to throttling)
    tick();
    tickRef.current = setInterval(tick, 250);

    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    };
  }, [status, handleTimerComplete]);

  // ─── Cleanup on unmount ─────────────────────────────────
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (beepRef.current) beepRef.current.stop();
      if (titleFlashRef.current) {
        clearInterval(titleFlashRef.current);
        document.title = originalTitleRef.current;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // ─── Controls ───────────────────────────────────────────
  const handleStart = () => {
    if (durationSeconds <= 0) return;

    // Initialize audio context on user gesture (required by browsers)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    if (status === 'paused') {
      // Resume from paused — set new end time based on remaining
      endTimeRef.current = Date.now() + remaining * 1000;
    } else {
      // Fresh start
      setRemaining(durationSeconds);
      endTimeRef.current = Date.now() + durationSeconds * 1000;
    }
    setStatus('running');
  };

  const handlePause = () => {
    setStatus('paused');
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  const handleReset = () => {
    setStatus('idle');
    setRemaining(durationSeconds);
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  const handleStopAlarm = () => {
    if (beepRef.current) { beepRef.current.stop(); beepRef.current = null; }
    if (titleFlashRef.current) {
      clearInterval(titleFlashRef.current);
      titleFlashRef.current = null;
      document.title = originalTitleRef.current;
    }
    setStatus('idle');
    setRemaining(durationSeconds);
  };

  const handleDurationChange = (mins: number) => {
    if (status === 'running' || status === 'paused') return;
    setDurationMinutes(mins);
    setRemaining(mins * 60);
  };

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  // ─── SVG ring calculations ─────────────────────────────
  const radius = 118;
  const circumference = 2 * Math.PI * radius;
  const progress = durationSeconds > 0 ? remaining / durationSeconds : 1;
  const dashOffset = circumference * (1 - progress);

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="pandora-timer-page">
      {/* Header */}
      <div className="pandora-timer-header">
        <h1 className="page-title">
          <span>Pandora</span> Timer
        </h1>
        <p className="page-subtitle">Focus deeply, break wisely</p>
      </div>

      {/* Mode Toggle */}
      <div className="pandora-mode-toggle">
        <button
          className={`pandora-mode-btn ${mode === 'focus' ? 'active-focus' : ''}`}
          onClick={() => { if (status === 'idle') setMode('focus'); }}
        >
          <Brain style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />
          Focus
        </button>
        <button
          className={`pandora-mode-btn ${mode === 'break' ? 'active-break' : ''}`}
          onClick={() => { if (status === 'idle') setMode('break'); }}
        >
          <Coffee style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />
          Break
        </button>
      </div>

      {/* Setup Card */}
      {status === 'idle' && (
        <div className="pandora-setup-card">
          {/* Subject & Chapter */}
          <div className="pandora-setup-row">
            <div className="form-group">
              <label className="form-label">Subject</label>
              <select
                className="form-select"
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
              >
                <option value="">— Select subject —</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Chapter</label>
              <select
                className="form-select"
                value={selectedChapterId}
                onChange={e => setSelectedChapterId(e.target.value)}
                disabled={!selectedSubjectId}
              >
                <option value="">— Select chapter —</option>
                {chapters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Topic */}
          <div className="form-group">
            <label className="form-label">Topic (optional)</label>
            <select
              className="form-select"
              value={selectedTopicId}
              onChange={e => setSelectedTopicId(e.target.value)}
              disabled={!selectedChapterId}
            >
              <option value="">— Select topic —</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div className="form-group pandora-duration-section">
            <label className="form-label">Duration</label>
            <div className="pandora-duration-input-row">
              <input
                type="number"
                className="form-input"
                min={1}
                max={1440}
                value={durationMinutes}
                onChange={e => handleDurationChange(Math.max(1, parseInt(e.target.value) || 0))}
              />
              <span className="pandora-duration-unit">minutes</span>
            </div>
            <div className="pandora-quick-picks">
              {QUICK_PICKS.map(qp => (
                <button
                  key={qp.minutes}
                  className={`pandora-quick-btn ${durationMinutes === qp.minutes ? 'selected' : ''}`}
                  onClick={() => handleDurationChange(qp.minutes)}
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Timer Display */}
      <div className="pandora-timer-display">
        <div className="pandora-timer-ring-wrap">
          <svg className="pandora-timer-svg" viewBox="0 0 260 260">
            <defs>
              <linearGradient id="pandora-gradient-focus" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <linearGradient id="pandora-gradient-break" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
            <circle
              className="pandora-timer-track"
              cx="130"
              cy="130"
              r={radius}
            />
            <circle
              className={`pandora-timer-progress ${mode === 'focus' ? 'focus-mode' : 'break-mode'}`}
              cx="130"
              cy="130"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>

          <div className="pandora-timer-center">
            <div className="pandora-timer-time">{formatTime(remaining)}</div>
            <div className="pandora-timer-label">
              {status === 'idle' && (mode === 'focus' ? 'Ready to focus' : 'Ready to break')}
              {status === 'running' && (mode === 'focus' ? 'Focusing…' : 'On break…')}
              {status === 'paused' && 'Paused'}
              {status === 'done' && 'Complete!'}
            </div>
          </div>
        </div>

        {(selectedChapterName || selectedTopicName) && (
          <div className="pandora-timer-target">
            {selectedChapterName && <>📖 {selectedChapterName}</>}
            {selectedTopicName && <> · {selectedTopicName}</>}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="pandora-controls">
        {status === 'idle' && (
          <button
            className={`pandora-ctrl-btn start ${mode === 'break' ? 'break-active' : ''}`}
            onClick={handleStart}
            disabled={durationSeconds <= 0}
          >
            <Play /> Start
          </button>
        )}

        {status === 'running' && (
          <button className="pandora-ctrl-btn pause" onClick={handlePause}>
            <Pause /> Pause
          </button>
        )}

        {status === 'paused' && (
          <>
            <button
              className={`pandora-ctrl-btn start ${mode === 'break' ? 'break-active' : ''}`}
              onClick={handleStart}
            >
              <Play /> Resume
            </button>
            <button className="pandora-ctrl-btn reset" onClick={handleReset}>
              <RotateCcw /> Reset
            </button>
          </>
        )}

        {(status === 'running' || status === 'paused') && status !== 'paused' && (
          <button className="pandora-ctrl-btn reset" onClick={handleReset}>
            <RotateCcw /> Reset
          </button>
        )}
      </div>

      {/* Notification permission hint */}
      {notifPermission === 'default' && status === 'idle' && (
        <div className="pandora-notif-hint">
          <button className="pandora-notif-btn" onClick={requestNotifPermission}>
            🔔 Enable notifications to get alerted in other tabs
          </button>
        </div>
      )}

      {/* ─── Alarm Overlay ─────────────────────────────────── */}
      {status === 'done' && (
        <div className="pandora-alarm-overlay">
          <div className="pandora-alarm-card">
            <div className="pandora-alarm-icon">🔔</div>
            <h2 className="pandora-alarm-title">
              {mode === 'focus' ? 'Focus Session Complete!' : 'Break Time Over!'}
            </h2>
            <p className="pandora-alarm-message">
              {mode === 'focus'
                ? 'Great work! Your focus session has ended.'
                : 'Time to get back to studying!'}
            </p>
            {(selectedChapterName || selectedTopicName) && (
              <div className="pandora-alarm-topic">
                {selectedChapterName && <>📖 {selectedChapterName}</>}
                {selectedTopicName && <> · {selectedTopicName}</>}
              </div>
            )}
            <button className="pandora-alarm-stop" onClick={handleStopAlarm}>
              <BellOff /> Stop Alarm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
