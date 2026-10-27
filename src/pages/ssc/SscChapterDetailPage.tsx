import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { sscChaptersService } from '../../services/ssc/sscChapters.service';
import { sscProgressService } from '../../services/ssc/sscProgress.service';
import { sscPracticeService } from '../../services/ssc/sscPractice.service';
import { sscRevisionService } from '../../services/ssc/sscRevision.service';
import { sscSettingsService } from '../../services/ssc/sscSettings.service';
import { SscNav } from '../../components/ssc/SscNav';
import { StatusBadge, ConfidenceStars, AccuracyBar } from '../../components/ssc/SscBadges';
import { LoadingState } from '../../components/ui/LoadingState';
import type {
  SscChapter,
  SscChapterProgress,
  SscPracticeSession,
  SscRevisionSession,
  SscUserSettings,
  ChapterStatus,
  PriorityLevel,
  PracticeSessionForm,
  RevisionSessionForm,
} from '../../types/ssc.types';
import {
  BookOpen, CheckSquare, Square, Edit3, Save, X,
  Plus, RefreshCw, Trash2, ChevronDown, ChevronUp, Target,
} from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';

export function SscChapterDetailPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [chapter, setChapter] = useState<(SscChapter & { ssc_subjects?: any }) | null>(null);
  const [progress, setProgress] = useState<SscChapterProgress | null>(null);
  const [sessions, setSessions] = useState<SscPracticeSession[]>([]);
  const [revisions, setRevisions] = useState<SscRevisionSession[]>([]);
  const [settings, setSettings] = useState<SscUserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [showPracticeForm, setShowPracticeForm] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [saving, setSaving] = useState(false);

  const [practiceForm, setPracticeForm] = useState<PracticeSessionForm>({
    chapter_id: chapterId ?? '',
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

  const [revisionForm, setRevisionForm] = useState<RevisionSessionForm>({
    chapter_id: chapterId ?? '',
    revision_date: new Date().toISOString().split('T')[0],
    attempted: null,
    correct: null,
    confidence_rating: null,
    notes: '',
    next_revision_at: null,
  });

  const load = useCallback(async () => {
    if (!user || !chapterId) return;
    setLoading(true);
    try {
      const [ch, prog, sess, revs, sett] = await Promise.all([
        sscChaptersService.getById(chapterId),
        sscProgressService.getForChapter(user.id, chapterId),
        sscPracticeService.getByChapter(user.id, chapterId),
        sscRevisionService.getByChapter(user.id, chapterId),
        sscSettingsService.get(user.id),
      ]);
      setChapter(ch);
      setProgress(prog);
      setSessions(sess);
      setRevisions(revs);
      setSettings(sett);
      setNotesText(prog?.personal_notes ?? '');
      if (ch) {
        setPracticeForm((f) => ({ ...f, subject_id: (ch as any).ssc_subjects?.id ?? '' }));
      }
    } catch {
      showToast('Failed to load chapter', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, chapterId]);

  useEffect(() => { load(); }, [load]);

  // ── Handlers ──────────────────────────────────────────────

  const setStatus = async (status: ChapterStatus) => {
    if (!user || !chapterId) return;
    try {
      const p = await sscProgressService.setStatus(user.id, chapterId, status);
      setProgress(p);
      showToast(`Status set to ${status}`, 'success');
    } catch { showToast('Failed to update status', 'error'); }
  };

  const toggleChecklist = async (field: 'learning_done' | 'notes_prepared' | 'practice_done') => {
    if (!user || !chapterId) return;
    const current = progress?.[field] ?? false;
    try {
      const p = await sscProgressService.setChecklist(user.id, chapterId, field, !current);
      setProgress(p);
    } catch { showToast('Failed to update checklist', 'error'); }
  };

  const saveNotes = async () => {
    if (!user || !chapterId) return;
    setSaving(true);
    try {
      const p = await sscProgressService.setNotes(user.id, chapterId, notesText);
      setProgress(p);
      setEditingNotes(false);
      showToast('Notes saved', 'success');
    } catch { showToast('Failed to save notes', 'error'); }
    finally { setSaving(false); }
  };

  const setConfidence = async (rating: number) => {
    if (!user || !chapterId) return;
    try {
      const p = await sscProgressService.setConfidence(user.id, chapterId, rating);
      setProgress(p);
    } catch { showToast('Failed to update confidence', 'error'); }
  };

  const setPriority = async (priority: PriorityLevel | null) => {
    if (!user || !chapterId) return;
    try {
      const p = await sscProgressService.setPriorityOverride(user.id, chapterId, priority);
      setProgress(p);
      showToast('Priority updated', 'success');
    } catch { showToast('Failed to update priority', 'error'); }
  };

  const submitPractice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await sscPracticeService.create(user.id, practiceForm);
      await sscProgressService.recalcFromPractice(user.id, chapterId!);
      setSessions(await sscPracticeService.getByChapter(user.id, chapterId!));
      const updated = await sscProgressService.getForChapter(user.id, chapterId!);
      setProgress(updated);
      setShowPracticeForm(false);
      showToast('Practice session logged!', 'success');
    } catch (err: any) {
      showToast(err.message ?? 'Failed to log practice', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;
    setSaving(true);
    try {
      const revCount = await sscRevisionService.getRevisionCount(user.id, chapterId!);
      const acc = revisionForm.attempted && revisionForm.correct
        ? Math.round((revisionForm.correct / revisionForm.attempted) * 100)
        : undefined;
      const nextRevAt = addDays(
        new Date(),
        settings.revision_intervals[Math.min(revCount, settings.revision_intervals.length - 1)]
      ).toISOString();

      await sscRevisionService.create(user.id, {
        ...revisionForm,
        next_revision_at: nextRevAt,
      });
      await sscProgressService.scheduleNextRevision(
        user.id, chapterId!, settings.revision_intervals, revCount,
        acc, revisionForm.confidence_rating ?? undefined
      );
      setRevisions(await sscRevisionService.getByChapter(user.id, chapterId!));
      const updated = await sscProgressService.getForChapter(user.id, chapterId!);
      setProgress(updated);
      setShowRevisionForm(false);
      showToast('Revision recorded!', 'success');
    } catch (err: any) {
      showToast(err.message ?? 'Failed to record revision', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading chapter…" />;
  if (!chapter) return <div className="ssc-page"><p>Chapter not found.</p></div>;

  const subject = (chapter as any).ssc_subjects;
  const accuracy = (progress?.questions_attempted ?? 0) > 0
    ? Math.round((progress!.questions_correct / progress!.questions_attempted) * 100)
    : 0;

  const STATUSES: ChapterStatus[] = ['not_started', 'in_progress', 'completed', 'revise'];

  return (
    <div className="ssc-page" style={{ animation: 'fadeIn 0.2s ease' }}>
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <button onClick={() => navigate('/ssc')}>SSC CGL</button>
        <span className="breadcrumb-sep">›</span>
        {subject && (
          <>
            <button onClick={() => navigate(`/ssc/syllabus/${subject.slug}`)}>
              {subject.name}
            </button>
            <span className="breadcrumb-sep">›</span>
          </>
        )}
        <span className="breadcrumb-current">{chapter.name}</span>
      </nav>

      <SscNav />

      {/* ── Header ── */}
      <div className="ssc-chapter-header card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title" style={{ margin: '0 0 0.35rem' }}>{chapter.name}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              {subject?.name} · {chapter.question_bank_count} questions in bank
            </p>
          </div>
          <StatusBadge status={progress?.status ?? 'not_started'} />
        </div>

        {/* Status controls */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`btn ssc-btn-sm ${progress?.status === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatus(s)}
            >
              {s === 'not_started' ? '○ Not Started' :
               s === 'in_progress' ? '◑ In Progress' :
               s === 'completed'   ? '● Completed' : '↺ Revise'}
            </button>
          ))}
        </div>
      </div>

      <div className="ssc-detail-grid">
        {/* ── Left column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Checklist */}
          <div className="card">
            <h3 className="ssc-card-title">Preparation Checklist</h3>
            {([
              ['learning_done',  'Study the concept'],
              ['notes_prepared', 'Prepare notes'],
              ['practice_done',  'Complete practice questions'],
            ] as const).map(([field, label]) => (
              <button
                key={field}
                className="ssc-checklist-item"
                onClick={() => toggleChecklist(field)}
              >
                {progress?.[field]
                  ? <CheckSquare size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  : <Square size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                <span style={{ textDecoration: progress?.[field] ? 'line-through' : undefined, color: progress?.[field] ? 'var(--text-muted)' : 'var(--text)' }}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Performance */}
          <div className="card">
            <h3 className="ssc-card-title">Practice Performance</h3>
            <div className="ssc-perf-grid">
              <div className="ssc-perf-item">
                <div className="ssc-perf-value">{progress?.questions_attempted ?? 0}</div>
                <div className="ssc-perf-label">Attempted</div>
              </div>
              <div className="ssc-perf-item">
                <div className="ssc-perf-value" style={{ color: 'var(--success)' }}>{progress?.questions_correct ?? 0}</div>
                <div className="ssc-perf-label">Correct</div>
              </div>
              <div className="ssc-perf-item">
                <div className="ssc-perf-value" style={{ color: 'var(--error)' }}>
                  {(progress?.questions_attempted ?? 0) - (progress?.questions_correct ?? 0)}
                </div>
                <div className="ssc-perf-label">Wrong</div>
              </div>
              <div className="ssc-perf-item">
                <div className="ssc-perf-value" style={{ color: accuracy >= 80 ? 'var(--success)' : accuracy >= 60 ? 'var(--warning)' : accuracy > 0 ? 'var(--error)' : 'var(--text-muted)' }}>
                  {accuracy > 0 ? `${accuracy}%` : '—'}
                </div>
                <div className="ssc-perf-label">Accuracy</div>
              </div>
            </div>
            {accuracy > 0 && <AccuracyBar accuracy={accuracy} />}
            {progress?.is_weak && (
              <div className="ssc-alert ssc-alert-warn" style={{ marginTop: '0.75rem' }}>
                ⚠ This chapter is flagged as weak (accuracy below 60%).
              </div>
            )}
            <button
              className="btn btn-ghost ssc-btn-sm"
              style={{ marginTop: '0.875rem' }}
              onClick={() => setShowPracticeForm(!showPracticeForm)}
            >
              <Plus size={13} /> Log Practice Session
            </button>
          </div>

          {/* Log practice form */}
          {showPracticeForm && (
            <div className="card ssc-form-card">
              <h3 className="ssc-card-title">Log Practice Session</h3>
              <form onSubmit={submitPractice} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="ssc-form-row">
                  <label className="ssc-label">Date</label>
                  <input type="date" className="ssc-input" value={practiceForm.session_date}
                    onChange={(e) => setPracticeForm((f) => ({ ...f, session_date: e.target.value }))} required />
                </div>
                <div className="ssc-form-row-4">
                  {(['attempted', 'correct', 'incorrect', 'skipped'] as const).map((field) => (
                    <div key={field}>
                      <label className="ssc-label" style={{ textTransform: 'capitalize' }}>{field}</label>
                      <input type="number" min={0} className="ssc-input" value={practiceForm[field]}
                        onChange={(e) => setPracticeForm((f) => ({ ...f, [field]: Number(e.target.value) }))} />
                    </div>
                  ))}
                </div>
                <div className="ssc-form-row">
                  <label className="ssc-label">Duration (min)</label>
                  <input type="number" min={0} className="ssc-input"
                    value={practiceForm.duration_minutes ?? ''}
                    onChange={(e) => setPracticeForm((f) => ({ ...f, duration_minutes: e.target.value ? Number(e.target.value) : null }))} />
                </div>
                <div className="ssc-form-row">
                  <label className="ssc-label">Source</label>
                  <input type="text" className="ssc-input" placeholder="e.g. Previous Year 2023"
                    value={practiceForm.practice_source ?? ''}
                    onChange={(e) => setPracticeForm((f) => ({ ...f, practice_source: e.target.value }))} />
                </div>
                <div className="ssc-form-row">
                  <label className="ssc-label">Notes</label>
                  <textarea className="ssc-input" rows={2}
                    value={practiceForm.notes ?? ''}
                    onChange={(e) => setPracticeForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary ssc-btn-sm" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Session'}
                  </button>
                  <button type="button" className="btn btn-ghost ssc-btn-sm" onClick={() => setShowPracticeForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Practice history */}
          {sessions.length > 0 && (
            <div className="card">
              <button
                className="ssc-collapsible-header"
                onClick={() => setShowSessions(!showSessions)}
              >
                <span className="ssc-card-title" style={{ margin: 0 }}>Practice History ({sessions.length})</span>
                {showSessions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showSessions && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {sessions.map((sess) => {
                    const acc = sess.attempted > 0 ? Math.round((sess.correct / sess.attempted) * 100) : 0;
                    return (
                      <div key={sess.id} className="ssc-session-row">
                        <span style={{ fontWeight: 600, minWidth: 90 }}>{format(parseISO(sess.session_date), 'd MMM yy')}</span>
                        <span>{sess.attempted} attempted</span>
                        <span style={{ color: 'var(--success)' }}>{sess.correct} correct</span>
                        <span style={{ color: acc >= 80 ? 'var(--success)' : acc >= 60 ? 'var(--warning)' : 'var(--error)', fontWeight: 600 }}>
                          {acc}%
                        </span>
                        {sess.practice_source && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{sess.practice_source}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Confidence & priority */}
          <div className="card">
            <h3 className="ssc-card-title">Self Assessment</h3>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Confidence</div>
              <ConfidenceStars
                rating={progress?.confidence_rating}
                interactive
                onChange={setConfidence}
              />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Priority Override</div>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {(['high', 'medium', 'low', null] as const).map((p) => (
                  <button
                    key={String(p)}
                    className={`btn ssc-btn-sm ${progress?.priority_override === p ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setPriority(p)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {p ?? 'Auto'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="ssc-card-title" style={{ margin: 0 }}>Personal Notes</h3>
              {!editingNotes ? (
                <button className="btn btn-ghost ssc-btn-sm" onClick={() => setEditingNotes(true)}>
                  <Edit3 size={13} /> Edit
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <button className="btn btn-primary ssc-btn-sm" onClick={saveNotes} disabled={saving}>
                    <Save size={13} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn btn-ghost ssc-btn-sm" onClick={() => { setEditingNotes(false); setNotesText(progress?.personal_notes ?? ''); }}>
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <textarea
                className="ssc-input ssc-notes-area"
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={8}
                placeholder="Add formulas, tricks, mistakes to avoid…"
              />
            ) : (
              <div className="ssc-notes-display">
                {progress?.personal_notes
                  ? <pre className="ssc-notes-pre">{progress.personal_notes}</pre>
                  : <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.875rem', margin: 0 }}>No notes yet. Click Edit to add.</p>
                }
              </div>
            )}
          </div>

          {/* Revision */}
          <div className="card">
            <h3 className="ssc-card-title">Revision</h3>
            {progress?.next_revision_at && (
              <div style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Next revision: </span>
                <strong style={{ color: 'var(--warning)' }}>
                  {format(parseISO(progress.next_revision_at), 'd MMM yyyy')}
                </strong>
              </div>
            )}
            {progress?.last_revised_at && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Last revised: {format(parseISO(progress.last_revised_at), 'd MMM yyyy')}
              </div>
            )}
            <button className="btn btn-ghost ssc-btn-sm" onClick={() => setShowRevisionForm(!showRevisionForm)}>
              <RefreshCw size={13} /> Record Revision
            </button>

            {showRevisionForm && (
              <form onSubmit={submitRevision} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="ssc-form-row">
                  <label className="ssc-label">Date</label>
                  <input type="date" className="ssc-input" value={revisionForm.revision_date}
                    onChange={(e) => setRevisionForm((f) => ({ ...f, revision_date: e.target.value }))} required />
                </div>
                <div className="ssc-form-row-2">
                  <div>
                    <label className="ssc-label">Attempted</label>
                    <input type="number" min={0} className="ssc-input"
                      value={revisionForm.attempted ?? ''}
                      onChange={(e) => setRevisionForm((f) => ({ ...f, attempted: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div>
                    <label className="ssc-label">Correct</label>
                    <input type="number" min={0} className="ssc-input"
                      value={revisionForm.correct ?? ''}
                      onChange={(e) => setRevisionForm((f) => ({ ...f, correct: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                </div>
                <div>
                  <label className="ssc-label">Confidence</label>
                  <ConfidenceStars
                    rating={revisionForm.confidence_rating}
                    interactive
                    onChange={(v) => setRevisionForm((f) => ({ ...f, confidence_rating: v }))}
                  />
                </div>
                <div className="ssc-form-row">
                  <label className="ssc-label">Notes</label>
                  <textarea className="ssc-input" rows={2}
                    value={revisionForm.notes ?? ''}
                    onChange={(e) => setRevisionForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary ssc-btn-sm" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Revision'}
                  </button>
                  <button type="button" className="btn btn-ghost ssc-btn-sm" onClick={() => setShowRevisionForm(false)}>Cancel</button>
                </div>
              </form>
            )}
          </div>

          {/* Revision history */}
          {revisions.length > 0 && (
            <div className="card">
              <button
                className="ssc-collapsible-header"
                onClick={() => setShowRevisions(!showRevisions)}
              >
                <span className="ssc-card-title" style={{ margin: 0 }}>Revision History ({revisions.length})</span>
                {showRevisions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showRevisions && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {revisions.map((rev) => {
                    const acc = rev.attempted && rev.correct
                      ? Math.round((rev.correct / rev.attempted) * 100)
                      : null;
                    return (
                      <div key={rev.id} className="ssc-session-row">
                        <span style={{ fontWeight: 600, minWidth: 90 }}>{format(parseISO(rev.revision_date), 'd MMM yy')}</span>
                        {acc !== null && <span style={{ fontWeight: 600, color: acc >= 80 ? 'var(--success)' : acc >= 60 ? 'var(--warning)' : 'var(--error)' }}>{acc}%</span>}
                        {rev.confidence_rating && <span>{'★'.repeat(rev.confidence_rating)}</span>}
                        {rev.notes && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flex: 1 }}>{rev.notes}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
