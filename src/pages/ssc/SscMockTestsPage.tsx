import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { sscMockTestsService } from '../../services/ssc/sscMockTests.service';
import { SscNav } from '../../components/ssc/SscNav';
import { AccuracyBar } from '../../components/ssc/SscBadges';
import { LoadingState } from '../../components/ui/LoadingState';
import type { SscMockTest, MockTestForm } from '../../types/ssc.types';
import { ClipboardList, Plus, Trash2, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const EMPTY_FORM: MockTestForm = {
  test_name: '',
  test_date: new Date().toISOString().split('T')[0],
  tier: '',
  total_questions: 200,
  attempted: null,
  correct: null,
  incorrect: null,
  score: null,
  max_score: 200,
  duration_minutes: 60,
  notes: '',
};

export function SscMockTestsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tests, setTests] = useState<SscMockTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MockTestForm>(EMPTY_FORM);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setTests(await sscMockTestsService.getAll(user.id));
    } catch { showToast('Failed to load mock tests', 'error'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await sscMockTestsService.create(user.id, form);
      await load();
      setShowForm(false);
      setForm(EMPTY_FORM);
      showToast('Mock test saved!', 'success');
    } catch { showToast('Failed to save mock test', 'error'); }
    finally { setSaving(false); }
  };

  const deleteTest = async (id: string) => {
    if (!confirm('Delete this mock test result?')) return;
    try {
      await sscMockTestsService.delete(id);
      setTests((prev) => prev.filter((t) => t.id !== id));
      showToast('Deleted', 'success');
    } catch { showToast('Failed to delete', 'error'); }
  };

  // Simple progression: last 5 tests accuracy
  const recentTests = tests.slice(0, 10);
  const overallBestAcc = tests.reduce((best, t) => {
    const acc = sscMockTestsService.calcAccuracy(t.attempted, t.correct);
    return acc > best ? acc : best;
  }, 0);
  const latestAcc = tests.length > 0
    ? sscMockTestsService.calcAccuracy(tests[0].attempted, tests[0].correct)
    : 0;

  if (loading) return <LoadingState message="Loading mock tests…" />;

  return (
    <div className="ssc-page" style={{ animation: 'fadeIn 0.2s ease' }}>
      <div className="ssc-page-header">
        <div className="ssc-page-header-left">
          <ClipboardList size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Mock Tests</h1>
            <p className="page-subtitle">{tests.length} tests recorded</p>
          </div>
        </div>
        <button className="btn btn-primary ssc-btn-sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> Add Result
        </button>
      </div>
      <SscNav />

      {/* Scoring note */}
      <div className="ssc-alert" style={{ marginBottom: '1.25rem' }}>
        ℹ Scoring rules differ by exam year and tier. Record raw scores only; the system won't apply unverified marking schemes automatically.
      </div>

      {/* Form */}
      {showForm && (
        <div className="card ssc-form-card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="ssc-card-title">Record Mock Test Result</h3>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="ssc-form-row-2">
              <div>
                <label className="ssc-label">Test Name *</label>
                <input type="text" className="ssc-input" required placeholder="e.g. SSC CGL Mock 01"
                  value={form.test_name} onChange={(e) => setForm((f) => ({ ...f, test_name: e.target.value }))} />
              </div>
              <div>
                <label className="ssc-label">Date *</label>
                <input type="date" className="ssc-input" required value={form.test_date}
                  onChange={(e) => setForm((f) => ({ ...f, test_date: e.target.value }))} />
              </div>
            </div>
            <div className="ssc-form-row-2">
              <div>
                <label className="ssc-label">Tier / Type</label>
                <input type="text" className="ssc-input" placeholder="Tier-1, Tier-2, etc."
                  value={form.tier ?? ''} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))} />
              </div>
              <div>
                <label className="ssc-label">Duration (min)</label>
                <input type="number" min={0} className="ssc-input"
                  value={form.duration_minutes ?? ''} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value ? Number(e.target.value) : null }))} />
              </div>
            </div>
            <div className="ssc-form-row-4">
              {(['total_questions', 'attempted', 'correct', 'incorrect'] as const).map((field) => (
                <div key={field}>
                  <label className="ssc-label" style={{ textTransform: 'capitalize' }}>
                    {field.replace('_', ' ')}
                  </label>
                  <input type="number" min={0} className="ssc-input"
                    value={form[field] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value ? Number(e.target.value) : null }))} />
                </div>
              ))}
            </div>
            <div className="ssc-form-row-2">
              <div>
                <label className="ssc-label">Score</label>
                <input type="number" className="ssc-input" step="0.01"
                  value={form.score ?? ''} onChange={(e) => setForm((f) => ({ ...f, score: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div>
                <label className="ssc-label">Max Score</label>
                <input type="number" className="ssc-input"
                  value={form.max_score ?? ''} onChange={(e) => setForm((f) => ({ ...f, max_score: e.target.value ? Number(e.target.value) : null }))} />
              </div>
            </div>
            <div className="ssc-form-row">
              <label className="ssc-label">Notes</label>
              <textarea className="ssc-input" rows={2}
                value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary ssc-btn-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn btn-ghost ssc-btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Analytics summary */}
      {tests.length > 0 && (
        <div className="ssc-stats-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="ssc-stat-chip">
            <div className="ssc-stat-value">{tests.length}</div>
            <div className="ssc-stat-label">Tests taken</div>
          </div>
          <div className="ssc-stat-chip">
            <div className="ssc-stat-value" style={{ color: 'var(--success)' }}>{overallBestAcc}%</div>
            <div className="ssc-stat-label">Best accuracy</div>
          </div>
          <div className="ssc-stat-chip">
            <div className="ssc-stat-value" style={{ color: latestAcc >= 80 ? 'var(--success)' : latestAcc >= 60 ? 'var(--warning)' : 'var(--error)' }}>
              {latestAcc}%
            </div>
            <div className="ssc-stat-label">Latest accuracy</div>
          </div>
        </div>
      )}

      {/* Tests list */}
      {tests.length === 0 ? (
        <div className="ssc-empty-card">
          <ClipboardList size={32} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem' }}>No mock tests recorded yet.</p>
          <button className="btn btn-primary ssc-btn-sm" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Record your first test
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {tests.map((test) => {
            const acc = sscMockTestsService.calcAccuracy(test.attempted, test.correct);
            const scorePct = sscMockTestsService.calcScorePct(test.score, test.max_score);
            return (
              <div key={test.id} className="card ssc-mock-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.2rem' }}>{test.test_name}</div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    {format(parseISO(test.test_date), 'd MMM yyyy')}
                    {test.tier && ` · ${test.tier}`}
                    {test.duration_minutes && ` · ${test.duration_minutes} min`}
                  </div>
                  <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                    {test.attempted !== null && <span>{test.attempted} attempted</span>}
                    {test.correct !== null && <span style={{ color: 'var(--success)' }}>{test.correct} correct</span>}
                    {test.incorrect !== null && <span style={{ color: 'var(--error)' }}>{test.incorrect} incorrect</span>}
                    {test.score !== null && test.max_score !== null && (
                      <span style={{ fontWeight: 600 }}>{test.score}/{test.max_score} ({scorePct}%)</span>
                    )}
                  </div>
                  {acc > 0 && (
                    <div style={{ marginTop: '0.5rem', maxWidth: 240 }}>
                      <AccuracyBar accuracy={acc} />
                    </div>
                  )}
                  {test.notes && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.775rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {test.notes}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '0.25rem', alignSelf: 'flex-start' }}
                  onClick={() => deleteTest(test.id)}
                  aria-label="Delete test"
                >
                  <Trash2 size={14} style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
