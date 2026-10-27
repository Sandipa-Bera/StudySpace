import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { sscMockTestsService } from '../../services/ssc/sscMockTests.service';
import { SscNav } from '../../components/ssc/SscNav';
import { AccuracyBar } from '../../components/ssc/SscBadges';
import { LoadingState } from '../../components/ui/LoadingState';
import { SscMockTestModal } from '../../components/ssc/SscMockTestModal';
import { ConfirmDialog } from '../../components/ssc/SscModal';
import type { SscMockTest } from '../../types/ssc.types';
import { ClipboardList, Plus, Trash2, Edit2, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function SscMockTestsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tests, setTests] = useState<SscMockTest[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal and delete states
  const [modalOpen, setModalOpen] = useState(false);
  const [testToEdit, setTestToEdit] = useState<SscMockTest | null>(null);
  const [deletingTest, setDeletingTest] = useState<SscMockTest | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setTests(await sscMockTestsService.getAll(user.id));
    } catch {
      showToast('Failed to load mock tests', 'error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleOpenAdd = () => {
    setTestToEdit(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (test: SscMockTest) => {
    setTestToEdit(test);
    setModalOpen(true);
  };

  const handleTestSaved = (savedTest: SscMockTest) => {
    setTests((prev) => {
      const idx = prev.findIndex((t) => t.id === savedTest.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedTest;
        return next;
      }
      return [savedTest, ...prev];
    });
    showToast(testToEdit ? 'Mock test updated!' : 'Mock test recorded!', 'success');
  };

  const confirmDeleteTest = async () => {
    if (!deletingTest) return;
    try {
      await sscMockTestsService.delete(deletingTest.id);
      setTests((prev) => prev.filter((t) => t.id !== deletingTest.id));
      setDeletingTest(null);
      showToast('Mock test deleted', 'success');
    } catch {
      showToast('Failed to delete mock test', 'error');
    }
  };

  // Progression & analytics
  const overallBestAcc = tests.reduce((best, t) => {
    const acc = sscMockTestsService.calcAccuracy(t.attempted, t.correct);
    return acc > best ? acc : best;
  }, 0);
  const latestAcc = tests.length > 0
    ? sscMockTestsService.calcAccuracy(tests[0].attempted, tests[0].correct)
    : 0;
  const avgScore = tests.length > 0
    ? Math.round(tests.reduce((acc, t) => acc + (t.score ?? 0), 0) / tests.length)
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
        <button className="btn btn-primary ssc-btn-sm" onClick={handleOpenAdd}>
          <Plus size={14} /> Add Result
        </button>
      </div>
      <SscNav />

      {/* Scoring note */}
      <div className="ssc-alert" style={{ marginBottom: '1.25rem' }}>
        ℹ Scoring rules differ by exam year and tier. Record raw scores only; the system won't apply unverified marking schemes automatically.
      </div>

      {/* Analytics Summary */}
      {tests.length > 0 && (
        <div className="ssc-stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="ssc-stat-chip">
            <div className="ssc-stat-value">{tests.length}</div>
            <div className="ssc-stat-label">Total tests</div>
          </div>
          <div className="ssc-stat-chip">
            <div className="ssc-stat-value" style={{ color: 'var(--accent)' }}>
              {avgScore > 0 ? avgScore : '—'}
            </div>
            <div className="ssc-stat-label">Average score</div>
          </div>
          <div className="ssc-stat-chip">
            <div className="ssc-stat-value" style={{ color: overallBestAcc >= 80 ? 'var(--success)' : 'var(--accent)' }}>
              {overallBestAcc > 0 ? `${overallBestAcc}%` : '—'}
            </div>
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
          <button className="btn btn-primary ssc-btn-sm" onClick={handleOpenAdd}>
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
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.2rem' }}>
                    {test.test_name}
                  </div>
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

                {/* Edit & Delete Action Buttons */}
                <div style={{ display: 'flex', gap: '0.375rem', alignSelf: 'flex-start' }}>
                  <button
                    className="btn btn-ghost ssc-btn-sm"
                    style={{ padding: '0.3rem 0.5rem' }}
                    onClick={() => handleOpenEdit(test)}
                    title="Edit test"
                    aria-label="Edit test"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="btn btn-ghost ssc-btn-sm"
                    style={{ padding: '0.3rem 0.5rem', color: 'var(--error)' }}
                    onClick={() => setDeletingTest(test)}
                    title="Delete test"
                    aria-label="Delete test"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mock Test Modal */}
      {user && (
        <SscMockTestModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          userId={user.id}
          testToEdit={testToEdit}
          onSaved={handleTestSaved}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingTest)}
        onCancel={() => setDeletingTest(null)}
        onConfirm={confirmDeleteTest}
        title="Delete Mock Test"
        message={`Are you sure you want to delete "${deletingTest?.test_name}"? Its associated sectional results and related test analytics may also be removed.`}
        confirmLabel="Delete Test"
        danger
      />
    </div>
  );
}
