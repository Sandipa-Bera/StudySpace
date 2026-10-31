import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useSscData } from '../../context/SscDataContext';
import { sscChaptersService } from '../../services/ssc/sscChapters.service';
import { sscProgressService } from '../../services/ssc/sscProgress.service';
import { sscPracticeService } from '../../services/ssc/sscPractice.service';
import { sscRevisionService } from '../../services/ssc/sscRevision.service';
import { sscSettingsService } from '../../services/ssc/sscSettings.service';
import { SscNav } from '../../components/ssc/SscNav';
import { StatusBadge, ConfidenceStars, AccuracyBar } from '../../components/ssc/SscBadges';
import { LoadingState } from '../../components/ui/LoadingState';
import { SscPracticeModal } from '../../components/ssc/SscPracticeModal';
import { SscRevisionModal } from '../../components/ssc/SscRevisionModal';
import { ConfirmDialog } from '../../components/ssc/SscModal';
import type {
  SscChapter,
  SscChapterProgress,
  SscPracticeSession,
  SscRevisionSession,
  SscUserSettings,
  ChapterStatus,
  PriorityLevel,
} from '../../types/ssc.types';
import {
  BookOpen, CheckSquare, Square, Edit3, Edit2, Save, X,
  Plus, RefreshCw, Trash2, ChevronDown, ChevronUp, Target, RotateCcw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function SscChapterDetailPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refresh: refreshContext } = useSscData();

  const [chapter, setChapter] = useState<(SscChapter & { ssc_subjects?: any }) | null>(null);
  const [progress, setProgress] = useState<SscChapterProgress | null>(null);
  const [sessions, setSessions] = useState<SscPracticeSession[]>([]);
  const [revisions, setRevisions] = useState<SscRevisionSession[]>([]);
  const [settings, setSettings] = useState<SscUserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Notes state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [confirmDeleteNotes, setConfirmDeleteNotes] = useState(false);

  // Sections collapse
  const [showSessions, setShowSessions] = useState(true);
  const [showRevisions, setShowRevisions] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals state
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);
  const [practiceToEdit, setPracticeToEdit] = useState<SscPracticeSession | null>(null);
  const [deletingSession, setDeletingSession] = useState<SscPracticeSession | null>(null);

  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionToEdit, setRevisionToEdit] = useState<SscRevisionSession | null>(null);
  const [deletingRevision, setDeletingRevision] = useState<SscRevisionSession | null>(null);

  const [confirmResetProgress, setConfirmResetProgress] = useState(false);

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
      showToast(`Status updated to ${status.replace('_', ' ')}`, 'success');
      refreshContext();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const toggleChecklist = async (field: 'learning_done' | 'notes_prepared' | 'practice_done') => {
    if (!user || !chapterId) return;
    const current = progress?.[field] ?? false;
    try {
      const p = await sscProgressService.setChecklist(user.id, chapterId, field, !current);
      setProgress(p);
      refreshContext();
    } catch {
      showToast('Failed to update checklist', 'error');
    }
  };

  const saveNotes = async () => {
    if (!user || !chapterId) return;
    setSaving(true);
    try {
      const p = await sscProgressService.setNotes(user.id, chapterId, notesText);
      setProgress(p);
      setEditingNotes(false);
      showToast('Notes saved', 'success');
      refreshContext();
    } catch {
      showToast('Failed to save notes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const executeDeleteNotes = async () => {
    if (!user || !chapterId) return;
    try {
      const p = await sscProgressService.deleteNotes(user.id, chapterId);
      setProgress(p);
      setNotesText('');
      setEditingNotes(false);
      setConfirmDeleteNotes(false);
      showToast('Notes deleted', 'success');
      refreshContext();
    } catch {
      showToast('Failed to delete notes', 'error');
    }
  };

  const executeResetProgress = async () => {
    if (!user || !chapterId) return;
    try {
      const p = await sscProgressService.resetProgress(user.id, chapterId);
      setProgress(p);
      setConfirmResetProgress(false);
      showToast('Chapter progress reset to Not Started', 'success');
      refreshContext();
    } catch {
      showToast('Failed to reset progress', 'error');
    }
  };

  const setConfidence = async (rating: number) => {
    if (!user || !chapterId) return;
    try {
      const p = await sscProgressService.setConfidence(user.id, chapterId, rating);
      setProgress(p);
      refreshContext();
    } catch {
      showToast('Failed to update confidence', 'error');
    }
  };

  const setPriority = async (priority: PriorityLevel | null) => {
    if (!user || !chapterId) return;
    try {
      const p = await sscProgressService.setPriorityOverride(user.id, chapterId, priority);
      setProgress(p);
      showToast('Priority updated', 'success');
      refreshContext();
    } catch {
      showToast('Failed to update priority', 'error');
    }
  };

  // Practice handlers
  const handleOpenAddPractice = () => {
    setPracticeToEdit(null);
    setPracticeModalOpen(true);
  };

  const handleOpenEditPractice = (sess: SscPracticeSession) => {
    setPracticeToEdit(sess);
    setPracticeModalOpen(true);
  };

  const handlePracticeSaved = async () => {
    if (!user || !chapterId) return;
    await sscProgressService.recalcFromPractice(user.id, chapterId);
    const updatedSess = await sscPracticeService.getByChapter(user.id, chapterId);
    const updatedProg = await sscProgressService.getForChapter(user.id, chapterId);
    setSessions(updatedSess);
    setProgress(updatedProg);
    showToast(practiceToEdit ? 'Practice session updated!' : 'Practice session logged!', 'success');
    refreshContext();
  };

  const confirmDeletePracticeSession = async () => {
    if (!deletingSession || !user || !chapterId) return;
    try {
      await sscPracticeService.delete(deletingSession.id);
      await sscProgressService.recalcFromPractice(user.id, chapterId);
      const updatedSess = await sscPracticeService.getByChapter(user.id, chapterId);
      const updatedProg = await sscProgressService.getForChapter(user.id, chapterId);
      setSessions(updatedSess);
      setProgress(updatedProg);
      setDeletingSession(null);
      showToast('Practice session deleted', 'success');
      refreshContext();
    } catch {
      showToast('Failed to delete practice session', 'error');
    }
  };

  // Revision handlers
  const handleOpenAddRevision = () => {
    setRevisionToEdit(null);
    setRevisionModalOpen(true);
  };

  const handleOpenEditRevision = (rev: SscRevisionSession) => {
    setRevisionToEdit(rev);
    setRevisionModalOpen(true);
  };

  const handleRevisionSaved = async () => {
    if (!user || !chapterId) return;
    const updatedRevs = await sscRevisionService.getByChapter(user.id, chapterId);
    const updatedProg = await sscProgressService.getForChapter(user.id, chapterId);
    setRevisions(updatedRevs);
    setProgress(updatedProg);
    showToast(revisionToEdit ? 'Revision record updated!' : 'Revision session recorded!', 'success');
    refreshContext();
  };

  const confirmDeleteRevisionSession = async () => {
    if (!deletingRevision || !user || !chapterId) return;
    try {
      await sscRevisionService.delete(deletingRevision.id);
      const updatedRevs = await sscRevisionService.getByChapter(user.id, chapterId);
      setRevisions(updatedRevs);
      setDeletingRevision(null);
      showToast('Revision record deleted', 'success');
      refreshContext();
    } catch {
      showToast('Failed to delete revision record', 'error');
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
              {chapter.exam_tier && ` · ${chapter.exam_tier}`}
            </p>
          </div>
          <StatusBadge status={progress?.status ?? 'not_started'} />
        </div>

        {/* Status controls and Reset option */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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

          <button
            className="btn btn-ghost ssc-btn-sm"
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={() => setConfirmResetProgress(true)}
            title="Reset progress to Not Started without deleting historical sessions"
          >
            <RotateCcw size={13} /> Reset Progress
          </button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="ssc-card-title" style={{ margin: 0 }}>Practice Performance</h3>
              <button
                className="btn btn-primary ssc-btn-sm"
                onClick={handleOpenAddPractice}
              >
                <Plus size={13} /> Log Practice
              </button>
            </div>

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
          </div>

          {/* Practice history with Edit & Delete */}
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
                      <div key={sess.id} className="ssc-session-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                          <span style={{ fontWeight: 600, minWidth: 85 }}>{format(parseISO(sess.session_date), 'd MMM yy')}</span>
                          <span>{sess.attempted} att</span>
                          <span style={{ color: 'var(--success)' }}>{sess.correct} cor</span>
                          <span style={{ color: acc >= 80 ? 'var(--success)' : acc >= 60 ? 'var(--warning)' : 'var(--error)', fontWeight: 600 }}>
                            {acc}%
                          </span>
                          {sess.practice_source && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{sess.practice_source}</span>
                          )}
                        </div>

                        {/* Edit and Delete Actions */}
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            className="btn btn-ghost ssc-btn-sm"
                            style={{ padding: '0.2rem 0.4rem' }}
                            onClick={() => handleOpenEditPractice(sess)}
                            title="Edit practice session"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="btn btn-ghost ssc-btn-sm"
                            style={{ padding: '0.2rem 0.4rem', color: 'var(--error)' }}
                            onClick={() => setDeletingSession(sess)}
                            title="Delete practice session"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
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

          {/* Notes with Edit & Delete */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="ssc-card-title" style={{ margin: 0 }}>Personal Notes</h3>
              {!editingNotes ? (
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <button className="btn btn-ghost ssc-btn-sm" onClick={() => setEditingNotes(true)}>
                    <Edit3 size={13} /> Edit
                  </button>
                  {progress?.personal_notes && (
                    <button
                      className="btn btn-ghost ssc-btn-sm"
                      style={{ color: 'var(--error)' }}
                      onClick={() => setConfirmDeleteNotes(true)}
                      title="Delete notes"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <button className="btn btn-primary ssc-btn-sm" onClick={saveNotes} disabled={saving}>
                    <Save size={13} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    className="btn btn-ghost ssc-btn-sm"
                    onClick={() => {
                      setEditingNotes(false);
                      setNotesText(progress?.personal_notes ?? '');
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <>
                <textarea
                  className="ssc-input ssc-notes-area"
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  rows={8}
                  placeholder="Add formulas, tricks, mistakes to avoid…"
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-ghost ssc-btn-sm"
                    onClick={() => {
                      setEditingNotes(false);
                      setNotesText(progress?.personal_notes ?? '');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary ssc-btn-sm"
                    onClick={saveNotes}
                    disabled={saving}
                  >
                    <Save size={13} /> {saving ? 'Saving…' : 'Save Notes'}
                  </button>
                </div>
              </>
            ) : (
              <div className="ssc-notes-display">
                {progress?.personal_notes
                  ? <pre className="ssc-notes-pre">{progress.personal_notes}</pre>
                  : <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.875rem', margin: 0 }}>No notes yet. Click Edit to add.</p>
                }
              </div>
            )}
          </div>

          {/* Revision with Edit & Delete on history */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="ssc-card-title" style={{ margin: 0 }}>Revision</h3>
              <button className="btn btn-primary ssc-btn-sm" onClick={handleOpenAddRevision}>
                <RefreshCw size={13} /> Record Revision
              </button>
            </div>

            {progress?.next_revision_at && (
              <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
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

            {/* Revision history */}
            {revisions.length > 0 && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                <button
                  className="ssc-collapsible-header"
                  onClick={() => setShowRevisions(!showRevisions)}
                >
                  <span style={{ fontSize: '0.825rem', fontWeight: 600 }}>Revision History ({revisions.length})</span>
                  {showRevisions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showRevisions && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {revisions.map((rev) => {
                      const acc = rev.attempted && rev.correct
                        ? Math.round((rev.correct / rev.attempted) * 100)
                        : null;
                      return (
                        <div key={rev.id} className="ssc-session-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                            <span style={{ fontWeight: 600, minWidth: 80 }}>{format(parseISO(rev.revision_date), 'd MMM yy')}</span>
                            {acc !== null && <span style={{ fontWeight: 600, color: acc >= 80 ? 'var(--success)' : acc >= 60 ? 'var(--warning)' : 'var(--error)' }}>{acc}%</span>}
                            {rev.confidence_rating && <span>{'★'.repeat(rev.confidence_rating)}</span>}
                            {rev.notes && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{rev.notes}</span>}
                          </div>

                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              className="btn btn-ghost ssc-btn-sm"
                              style={{ padding: '0.2rem 0.4rem' }}
                              onClick={() => handleOpenEditRevision(rev)}
                              title="Edit revision record"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              className="btn btn-ghost ssc-btn-sm"
                              style={{ padding: '0.2rem 0.4rem', color: 'var(--error)' }}
                              onClick={() => setDeletingRevision(rev)}
                              title="Delete revision record"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
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

      {/* Practice Modal for Add & Edit */}
      {user && chapterId && (
        <SscPracticeModal
          isOpen={practiceModalOpen}
          onClose={() => setPracticeModalOpen(false)}
          userId={user.id}
          chapterId={chapterId}
          subjectId={subject?.id ?? ''}
          sessionToEdit={practiceToEdit}
          onSaved={handlePracticeSaved}
        />
      )}

      {/* Revision Modal for Add & Edit */}
      {user && chapterId && (
        <SscRevisionModal
          isOpen={revisionModalOpen}
          onClose={() => setRevisionModalOpen(false)}
          userId={user.id}
          chapterId={chapterId}
          revisionToEdit={revisionToEdit}
          onSaved={handleRevisionSaved}
        />
      )}

      {/* Reset Progress Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmResetProgress}
        onCancel={() => setConfirmResetProgress(false)}
        onConfirm={executeResetProgress}
        title="Reset Chapter Progress"
        message={`Are you sure you want to reset "${chapter.name}" to Not Started? This clears your checklist and status, but keeps your practice sessions and revision logs intact.`}
        confirmLabel="Reset to Not Started"
        danger
      />

      {/* Delete Notes Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDeleteNotes}
        onCancel={() => setConfirmDeleteNotes(false)}
        onConfirm={executeDeleteNotes}
        title="Delete Chapter Notes"
        message="Are you sure you want to delete your notes for this chapter? This cannot be undone. (Your chapter progress and practice records are unaffected.)"
        confirmLabel="Delete Notes"
        danger
      />

      {/* Delete Practice Session Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingSession)}
        onCancel={() => setDeletingSession(null)}
        onConfirm={confirmDeletePracticeSession}
        title="Delete Practice Session"
        message="Are you sure you want to delete this practice session? Your chapter accuracy and attempted question counts will be recalculated."
        confirmLabel="Delete Session"
        danger
      />

      {/* Delete Revision Session Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingRevision)}
        onCancel={() => setDeletingRevision(null)}
        onConfirm={confirmDeleteRevisionSession}
        title="Delete Revision Record"
        message="Are you sure you want to delete this revision log? It will be removed from your revision history."
        confirmLabel="Delete Record"
        danger
      />
    </div>
  );
}
