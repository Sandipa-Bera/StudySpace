import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { sscSettingsService } from '../../services/ssc/sscSettings.service';
import { SscNav } from '../../components/ssc/SscNav';
import { LoadingState } from '../../components/ui/LoadingState';
import type { SscUserSettings } from '../../types/ssc.types';
import { Settings, Save } from 'lucide-react';

export function SscSettingsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<SscUserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local editable state
  const [dailyMinutes, setDailyMinutes] = useState(120);
  const [intervals, setIntervals] = useState([1, 3, 7, 14, 30]);
  const [weights, setWeights] = useState({ exam_relevance: 35, weakness: 30, revision_urgency: 20, dependency: 15 });
  const [intervalInput, setIntervalInput] = useState('1,3,7,14,30');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const sett = await sscSettingsService.get(user.id);
      setSettings(sett);
      setDailyMinutes(sett.daily_study_minutes);
      setIntervals(sett.revision_intervals);
      setIntervalInput(sett.revision_intervals.join(','));
      setWeights(sett.priority_weights);
    } catch { showToast('Failed to load settings', 'error'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!user) return;
    const parsedIntervals = intervalInput
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    if (parsedIntervals.length < 2) {
      showToast('Enter at least 2 revision intervals separated by commas', 'error');
      return;
    }
    const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0);
    if (weightTotal !== 100) {
      showToast(`Priority weights must sum to 100 (current: ${weightTotal})`, 'error');
      return;
    }
    setSaving(true);
    try {
      await sscSettingsService.save(user.id, {
        daily_study_minutes: dailyMinutes,
        revision_intervals: parsedIntervals,
        priority_weights: weights,
      });
      setIntervals(parsedIntervals);
      showToast('Settings saved!', 'success');
    } catch { showToast('Failed to save settings', 'error'); }
    finally { setSaving(false); }
  };

  const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0);

  if (loading) return <LoadingState message="Loading settings…" />;

  return (
    <div className="ssc-page" style={{ animation: 'fadeIn 0.2s ease' }}>
      <div className="ssc-page-header">
        <div className="ssc-page-header-left">
          <Settings size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>SSC CGL Settings</h1>
            <p className="page-subtitle">Customise revision intervals, priority weights and daily goals</p>
          </div>
        </div>
      </div>
      <SscNav />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 560 }}>
        {/* Daily goal */}
        <div className="card">
          <h3 className="ssc-card-title">Daily Study Goal</h3>
          <label className="ssc-label">Minutes per day</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="range" min={30} max={480} step={15}
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontWeight: 700, minWidth: 60, color: 'var(--accent)', fontFamily: 'Lora, serif' }}>
              {dailyMinutes} min
            </span>
          </div>
          <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            ({Math.floor(dailyMinutes / 60)}h {dailyMinutes % 60}m)
          </p>
        </div>

        {/* Revision intervals */}
        <div className="card">
          <h3 className="ssc-card-title">Revision Intervals (days)</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Comma-separated list of days after which to schedule the next revision.
            The system picks the next interval in sequence after each completed revision.
            Adaptive adjustments shorten the interval when accuracy is below 60% or confidence ≤ 2,
            and lengthen it when accuracy ≥ 85% and confidence ≥ 4.
          </p>
          <input
            type="text"
            className="ssc-input"
            value={intervalInput}
            onChange={(e) => setIntervalInput(e.target.value)}
            placeholder="e.g. 1,3,7,14,30"
          />
          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {intervals.map((v, i) => (
              <span key={i} className="ssc-badge ssc-badge-blue">{v}d</span>
            ))}
          </div>
        </div>

        {/* Priority weights */}
        <div className="card">
          <h3 className="ssc-card-title">Priority Score Weights</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Must sum to exactly 100. These weights determine how chapter priority is scored.
          </p>
          {([
            ['exam_relevance',   'Exam Relevance (unverified proxy)'],
            ['weakness',         'Personal Weakness (low accuracy)'],
            ['revision_urgency', 'Revision Urgency (overdue)'],
            ['dependency',       'Incompleteness'],
          ] as const).map(([key, label]) => (
            <div key={key} style={{ marginBottom: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <label className="ssc-label" style={{ marginBottom: 0 }}>{label}</label>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{weights[key]}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={weights[key]}
                onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
          ))}
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: weightTotal === 100 ? 'var(--success)' : 'var(--error)' }}>
            Total: {weightTotal}% {weightTotal !== 100 && '(must equal 100)'}
          </div>
        </div>

        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <Save size={15} /> {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
