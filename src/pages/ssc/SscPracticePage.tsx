import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useSscData } from '../../context/SscDataContext';
import { sscSubjectsService } from '../../services/ssc/sscSubjects.service';
import { sscChaptersService } from '../../services/ssc/sscChapters.service';
import { sscPracticeService } from '../../services/ssc/sscPractice.service';
import { sscProgressService } from '../../services/ssc/sscProgress.service';
import { SscNav } from '../../components/ssc/SscNav';
import { AccuracyBar } from '../../components/ssc/SscBadges';
import { LoadingState } from '../../components/ui/LoadingState';
import { SscPracticeModal } from '../../components/ssc/SscPracticeModal';
import { ConfirmDialog } from '../../components/ssc/SscModal';
import type {
  SscSubject,
  SscChapter,
  SscPracticeSession,
  SscChapterProgress,
  PracticeSessionForm,
} from '../../types/ssc.types';
import { BarChart2, Plus, Trash2, Edit2, TrendingUp, TrendingDown } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';

export function SscPracticePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refresh: refreshContext } = useSscData();

  const [subjects, setSubjects] = useState<SscSubject[]>([]);
  const [chapters, setChapters] = useState<SscChapter[]>([]);
  const [sessions, setSessions] = useState<SscPracticeSession[]>([]);
  const [progress, setProgress] = useState<SscChapterProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterSubject, setFilterSubject] = useState('');

  // Edit & Delete modal states
  const [practiceToEdit, setPracticeToEdit] = useState<SscPracticeSession | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState<SscPracticeSession | null>(null);

  const [form, setForm] = useState<PracticeSessionForm>({
    chapter_id: '',
    subject_id: '',
    session_date: new Date().toISOString().split('T')[0],
    attempted: 0,
    correct: 0,
    incorrect: 0,
    skipped: 0,
    duration_minutes: null,
    practice_source: '',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [subs, chs, sess, prog] = await Promise.all([
        sscSubjectsService.getAll(),
        sscChaptersService.getAll(),
        sscPracticeService.getAll(user.id),
        sscProgressService.getAllForUser(user.id),
      ]);
      setSubjects(subs);
      setChapters(chs);
      setSessions(sess);
      setProgress(prog);
    } catch { showToast('Failed to load practice data', 'error'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const filteredSessions = useMemo(() => {
    if (!filterSubject) return sessions;
    return sessions.filter((s) => s.subject_id === filterSubject);
  }, [sessions, filterSubject]);

  // Subject-wise accuracy
  const subjectStats = useMemo(() => {
    return subjects.map((sub) => {
      const subSessions = sessions.filter((s) => s.subject_id === sub.id);
      const attempted = subSessions.reduce((a, s) => a + s.attempted, 0);
      const correct   = subSessions.reduce((a, s) => a + s.correct, 0);
      const accuracy  = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
      return { subject: sub, attempted, correct, accuracy };
    });
  }, [subjects, sessions]);

  // Weakest chapters (from progress)
  const weakest = useMemo(() => {
    return [...progress]
      .filter((p) => p.questions_attempted > 10)
      .map((p) => ({
        p,
        chapter: chapterMap.get(p.chapter_id),
        accuracy: Math.round((p.questions_correct / p.questions_attempted) * 100),
      }))
      .filter((x) => x.chapter)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);
  }, [progress, chapterMap]);

  const totalAttempted = sessions.reduce((a, s) => a + s.attempted, 0);
  const totalCorrect   = sessions.reduce((a, s) => a + s.correct, 0);
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  const handleSubjectChange = (subjectId: string) => {
    setForm((f) => ({ ...f, subject_id: subjectId, chapter_id: '' }));
  };

  const submitPractice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.chapter_id || !form.subject_id) {
      showToast('Please select a subject and chapter', 'error');
      return;
    }
    setSaving(true);
    try {
      await sscPracticeService.create(user.id, form);
      await sscProgressService.recalcFromPractice(user.id, form.chapter_id);
      await load();
      setShowForm(false);
      showToast('Practice session logged!', 'success');
    } catch (err: any) {
      showToast(err.message ?? 'Failed to log practice', 'error');
    } finally { setSaving(false); }
  };

  const handleOpenEdit = (sess: SscPracticeSession) => {
    setPracticeToEdit(sess);
    setModalOpen(true);
  };

  const handlePracticeSaved = async (saved: SscPracticeSession) => {
    if (!user) return;
    await sscProgressService.recalcFromPractice(user.id, saved.chapter_id);
    await load();
    refreshContext();
    showToast('Practice session updated!', 'success');
  };

  const confirmDeleteSession = async () => {
    if (!deletingSession || !user) return;
    try {
      await sscPracticeService.delete(deletingSession.id);
      await sscProgressService.recalcFromPractice(user.id, deletingSession.chapter_id);
      setSessions((prev) => prev.filter((s) => s.id !== deletingSession.id));
      setDeletingSession(null);
      await load();
      refreshContext();
      showToast('Practice session deleted', 'success');
    } catch {
      showToast('Failed to delete session', 'error');
    }
  };

  if (loading) return <LoadingState message="Loading practice data…" />;

  return (
    <div className="ssc-page" style={{ animation: 'fadeIn 0.2s ease' }}>
      <div className="ssc-page-header">
        <div className="ssc-page-header-left">
          <BarChart2 size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Practice & Analytics</h1>
            <p className="page-subtitle">{sessions.length} sessions · {totalAttempted.toLocaleString()} questions attempted</p>
          </div>
        </div>
        <button className="btn btn-primary ssc-btn-sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> Log Session
        </button>
      </div>
      <SscNav />

      {/* ── Log session form ── */}
      {showForm && (
        <div className="card ssc-form-card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="ssc-card-title">New Practice Session</h3>
          <form onSubmit={submitPractice} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="ssc-form-row-2">
              <div>
                <label className="ssc-label">Subject *</label>
                <select className="ssc-input" value={form.subject_id} onChange={(e) => handleSubjectChange(e.target.value)} required>
                  <option value="">Select subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="ssc-label">Chapter *</label>
                <select className="ssc-input" value={form.chapter_id}
                  onChange={(e) => setForm((f) => ({ ...f, chapter_id: e.target.value }))} required
                  disabled={!form.subject_id}>
                  <option value="">Select chapter</option>
                  {chapters.filter((c) => c.subject_id === form.subject_id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="ssc-form-row">
              <label className="ssc-label">Date</label>
              <input type="date" className="ssc-input" value={form.session_date}
                onChange={(e) => setForm((f) => ({ ...f, session_date: e.target.value }))} required />
            </div>
            <div className="ssc-form-row-4">
              {(['attempted', 'correct', 'incorrect', 'skipped'] as const).map((field) => (
                <div key={field}>
                  <label className="ssc-label" style={{ textTransform: 'capitalize' }}>{field}</label>
                  <input type="number" min={0} className="ssc-input" value={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: Number(e.target.value) }))} />
                </div>
              ))}
            </div>
            <div className="ssc-form-row-2">
              <div>
                <label className="ssc-label">Duration (min)</label>
                <input type="number" min={0} className="ssc-input"
                  value={form.duration_minutes ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div>
                <label className="ssc-label">Source</label>
                <input type="text" className="ssc-input" placeholder="e.g. PY 2023"
                  value={form.practice_source ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, practice_source: e.target.value }))} />
              </div>
            </div>
            <div className="ssc-form-row">
              <label className="ssc-label">Notes</label>
              <textarea className="ssc-input" rows={2}
                value={form.notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary ssc-btn-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save Session'}
              </button>
              <button type="button" className="btn btn-ghost ssc-btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Analytics ── */}
      {sessions.length === 0 ? (
        <div className="ssc-empty-card">
          <BarChart2 size={32} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem' }}>No practice sessions yet.</p>
          <button className="btn btn-primary ssc-btn-sm" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Log your first session
          </button>
        </div>
      ) : (
        <>
          {/* Overall stat row */}
          <div className="ssc-stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="ssc-stat-chip">
              <div className="ssc-stat-value">{sessions.length}</div>
              <div className="ssc-stat-label">Sessions</div>
            </div>
            <div className="ssc-stat-chip">
              <div className="ssc-stat-value">{totalAttempted.toLocaleString()}</div>
              <div className="ssc-stat-label">Attempted</div>
            </div>
            <div className="ssc-stat-chip">
              <div className="ssc-stat-value" style={{ color: 'var(--success)' }}>{totalCorrect.toLocaleString()}</div>
              <div className="ssc-stat-label">Correct</div>
            </div>
            <div className="ssc-stat-chip">
              <div className="ssc-stat-value" style={{ color: overallAccuracy >= 80 ? 'var(--success)' : overallAccuracy >= 60 ? 'var(--warning)' : 'var(--error)' }}>
                {overallAccuracy}%
              </div>
              <div className="ssc-stat-label">Overall Accuracy</div>
            </div>
          </div>

          {/* Subject-wise accuracy */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h3 className="ssc-card-title">Subject-wise Accuracy</h3>
            {subjectStats.map(({ subject, attempted, accuracy }) => (
              <div key={subject.id} style={{ marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 500 }}>{subject.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {attempted.toLocaleString()} attempted
                    {accuracy > 0 && ` · ${accuracy}%`}
                  </span>
                </div>
                {attempted > 0
                  ? <AccuracyBar accuracy={accuracy} />
                  : <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No sessions yet</div>
                }
              </div>
            ))}
          </div>

          {/* Weak chapters */}
          {weakest.length > 0 && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h3 className="ssc-card-title">
                <TrendingDown size={14} style={{ color: 'var(--error)' }} /> Weakest Chapters
              </h3>
              {weakest.map(({ p, chapter, accuracy }) => (
                <div
                  key={p.chapter_id}
                  className="ssc-weak-row"
                  onClick={() => navigate(`/ssc/chapters/${p.chapter_id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/ssc/chapters/${p.chapter_id}`)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{chapter!.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {p.questions_attempted} attempted
                    </div>
                  </div>
                  <div style={{ minWidth: 120 }}>
                    <AccuracyBar accuracy={accuracy} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Session history */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
              <h3 className="ssc-card-title" style={{ margin: 0 }}>Practice Log</h3>
              <select className="ssc-select" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
                <option value="">All subjects</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filteredSessions.map((sess) => {
                const chapter = chapterMap.get(sess.chapter_id);
                const subject = subjectMap.get(sess.subject_id);
                const acc = sess.attempted > 0 ? Math.round((sess.correct / sess.attempted) * 100) : 0;
                return (
                  <div key={sess.id} className="ssc-session-card">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{chapter?.name ?? '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {subject?.name} · {format(parseISO(sess.session_date), 'd MMM yyyy')}
                        {sess.practice_source && ` · ${sess.practice_source}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {sess.attempted} q
                      </span>
                      <span style={{
                        fontWeight: 700, fontSize: '0.9rem',
                        color: acc >= 80 ? 'var(--success)' : acc >= 60 ? 'var(--warning)' : 'var(--error)',
                      }}>
                        {acc}%
                      </span>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          className="btn btn-ghost ssc-btn-sm"
                          style={{ padding: '0.2rem 0.4rem' }}
                          onClick={() => handleOpenEdit(sess)}
                          title="Edit session"
                          aria-label="Edit session"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="btn btn-ghost ssc-btn-sm"
                          style={{ padding: '0.2rem 0.4rem', color: 'var(--error)' }}
                          onClick={() => setDeletingSession(sess)}
                          title="Delete session"
                          aria-label="Delete session"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Practice Modal for Editing */}
      {user && practiceToEdit && (
        <SscPracticeModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setPracticeToEdit(null); }}
          userId={user.id}
          chapterId={practiceToEdit.chapter_id}
          subjectId={practiceToEdit.subject_id}
          sessionToEdit={practiceToEdit}
          onSaved={handlePracticeSaved}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingSession)}
        onCancel={() => setDeletingSession(null)}
        onConfirm={confirmDeleteSession}
        title="Delete Practice Session"
        message="Are you sure you want to delete this practice session? Your chapter accuracy and total attempted questions will be recalculated."
        confirmLabel="Delete Session"
        danger
      />
    </div>
  );
}
