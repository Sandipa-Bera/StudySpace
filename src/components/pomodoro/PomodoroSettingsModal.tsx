import React, { useState } from 'react';
import { X, Volume2, Bell, Sparkles, Clock, Check, RotateCcw } from 'lucide-react';
import type { PomodoroSettings } from '../../types/pomodoro.types';
import { audioAlert } from '../../utils/audioAlert';
import { DEFAULT_SETTINGS } from '../../services/pomodoro.service';

interface PomodoroSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PomodoroSettings;
  onSave: (settings: PomodoroSettings) => void;
  notifPermission: NotificationPermission | 'unsupported';
  onRequestNotification: () => void;
}

export function PomodoroSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
  notifPermission,
  onRequestNotification,
}: PomodoroSettingsModalProps) {
  const [formData, setFormData] = useState<PomodoroSettings>(settings);

  // Sync state when opening
  React.useEffect(() => {
    if (isOpen) {
      setFormData(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleTestSound = () => {
    audioAlert.testBeep(formData.alarmVolume);
  };

  const handleResetDefaults = () => {
    setFormData(DEFAULT_SETTINGS);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="pomo-modal-backdrop" onClick={onClose}>
      <div
        className="pomo-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pomo-settings-title"
      >
        <div className="pomo-modal-header">
          <div className="pomo-modal-title-wrap">
            <Clock className="w-5 h-5 pomo-accent-icon" />
            <h2 id="pomo-settings-title" className="pomo-modal-title">
              Timer Preferences
            </h2>
          </div>
          <button
            className="pomo-modal-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pomo-modal-form">
          {/* ── Durations ── */}
          <div className="pomo-settings-section">
            <h3 className="pomo-section-label">Session Durations (minutes)</h3>
            <div className="pomo-duration-grid">
              <div className="pomo-field-group">
                <label className="pomo-input-label">Focus</label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  className="pomo-number-input"
                  value={formData.focusDurationMinutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      focusDurationMinutes: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  required
                />
              </div>

              <div className="pomo-field-group">
                <label className="pomo-input-label">Short Break</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="pomo-number-input"
                  value={formData.shortBreakDurationMinutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shortBreakDurationMinutes: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  required
                />
              </div>

              <div className="pomo-field-group">
                <label className="pomo-input-label">Long Break</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  className="pomo-number-input"
                  value={formData.longBreakDurationMinutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      longBreakDurationMinutes: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="pomo-field-row mt-3">
              <label className="pomo-input-label">
                Long Break Interval (cycles before long break)
              </label>
              <input
                type="number"
                min={1}
                max={12}
                className="pomo-number-input w-24 text-center"
                value={formData.longBreakInterval}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    longBreakInterval: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                required
              />
            </div>
          </div>

          {/* ── Sound & Volume ── */}
          <div className="pomo-settings-section">
            <div className="flex items-center justify-between mb-2">
              <h3 className="pomo-section-label">
                <Volume2 className="w-4 h-4 inline mr-1 text-primary" /> Alarm Sound
              </h3>
              <button
                type="button"
                className="pomo-text-btn"
                onClick={handleTestSound}
              >
                Test Chime 🔔
              </button>
            </div>
            <div className="pomo-volume-row">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                className="pomo-range-slider"
                value={formData.alarmVolume}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    alarmVolume: parseInt(e.target.value) || 0,
                  })
                }
              />
              <span className="pomo-volume-badge">{formData.alarmVolume}%</span>
            </div>
            <p className="pomo-helper-text">
              Plays a continuous gentle chime when countdown finishes until stopped.
            </p>
          </div>

          {/* ── Notifications & Auto Transition ── */}
          <div className="pomo-settings-section">
            <h3 className="pomo-section-label">Automation & Alerts</h3>

            <div className="pomo-toggle-item">
              <div className="pomo-toggle-info">
                <div className="pomo-toggle-title">
                  <Bell className="w-4 h-4 inline mr-1 text-primary" /> Desktop Notifications
                </div>
                <div className="pomo-toggle-desc">
                  Alert me when tabs are in the background or minimized
                </div>
              </div>
              <div className="flex items-center gap-2">
                {notifPermission === 'default' && (
                  <button
                    type="button"
                    className="pomo-btn-secondary text-xs px-2.5 py-1"
                    onClick={onRequestNotification}
                  >
                    Enable
                  </button>
                )}
                {notifPermission === 'denied' && (
                  <span className="text-xs text-rose-500 font-medium">Blocked in browser</span>
                )}
                <input
                  type="checkbox"
                  className="pomo-checkbox"
                  checked={formData.browserNotifications}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      browserNotifications: e.target.checked,
                    })
                  }
                />
              </div>
            </div>

            <div className="pomo-toggle-item mt-3">
              <div className="pomo-toggle-info">
                <div className="pomo-toggle-title">
                  <Sparkles className="w-4 h-4 inline mr-1 text-primary" /> Auto-Start Next Phase
                </div>
                <div className="pomo-toggle-desc">
                  Automatically begin countdown as soon as the alarm is dismissed
                </div>
              </div>
              <input
                type="checkbox"
                className="pomo-checkbox"
                checked={formData.autoTransition}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    autoTransition: e.target.checked,
                  })
                }
              />
            </div>
          </div>

          {/* ── Modal Footer ── */}
          <div className="pomo-modal-footer">
            <button
              type="button"
              className="pomo-btn-subtle"
              onClick={handleResetDefaults}
            >
              <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Reset Defaults
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="pomo-btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="pomo-btn-primary"
              >
                <Check className="w-4 h-4 inline mr-1" /> Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
