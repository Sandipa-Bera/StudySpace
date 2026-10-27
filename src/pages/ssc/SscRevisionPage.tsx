import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useSscData } from '../../context/SscDataContext';
import { sscSubjectsService } from '../../services/ssc/sscSubjects.service';
import { sscChaptersService } from '../../services/ssc/sscChapters.service';
import { sscProgressService } from '../../services/ssc/sscProgress.service';
import { sscRevisionService } from '../../services/ssc/sscRevision.service';
import { SscNav } from '../../components/ssc/SscNav';
import { StatusBadge } from '../../components/ssc/SscBadges';
import { LoadingState } from '../../components/ui/LoadingState';
import { SscRevisionModal } from '../../components/ssc/SscRevisionModal';
import { ConfirmDialog } from '../../components/ssc/SscModal';
import type {
  SscSubject,
  SscChapter,
  SscChapterProgress,
  SscRevisionSession,
} from '../../types/ssc.types';
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronRight,
  Calendar,
  Edit2,
  Trash2,
  Plus,
  History,
} from 'lucide-react';
import { format, parseISO, isBefore, isToday, addDays, differenceInDays } from 'date-fns';

type RevSection = 'today' | 'overdue' | 'week' | 'upcoming' | 'recent' | 'history' | 'weak';

export function SscRevisionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { refresh: refreshContext } = useSscData();

  const [subjects, setSubjects] = useState<SscSubject[]>([]);
  const [chapters, setChapters] = useState<SscChapter[]>([]);
  const [progress, setProgress] = useState<SscChapterProgress[]>([]);
  const [revisionSessions, setRevisionSessions] = useState<SscRevisionSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Section initialized from query parameter if provided
  const querySection = searchParams.get('section') as RevSection | null;
  const [activeSection, setActiveSection] = useState<RevSection>(
    querySection && ['today', 'overdue', 'week', 'upcoming', 'recent', 'history', 'weak'].includes(querySection)
      ? querySection
      : 'today'
  );

  // Modal and action states
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [revisionToEdit, setRevisionToEdit] = useState<SscRevisionSession | null>(null);
  const [deletingSession, setDeletingSession] = useState<SscRevisionSession | null>(null);
  const [reschedulingChapter, setReschedulingChapter] = useState<SscChapterProgress | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [subs, chs, prog, revs] = await Promise.all([
        sscSubjectsService.getAll(),
        sscChaptersService.getAll(),
        sscProgressService.getAllForUser(user.id),
        sscRevisionService.getAll(user.id),
      ]);
      setSubjects(subs);
      setChapters(chs);
      setProgress(prog);
      setRevisionSessions(revs);
    } catch {
      showToast('Failed to load revision centre', 'error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const today = new Date();
  const nextWeek = addDays(today, 7);

  const withRevision = progress.filter((p) => p.next_revision_at);
  const overdue = withRevision.filter((p) => isBefore(parseISO(p.next_revision_at!), today));
  const dueToday = withRevision.filter((p) => isToday(parseISO(p.next_revision_at!)));
  const dueWeek  = withRevision.filter((p) => {
    const d = parseISO(p.next_revision_at!);
    return !isBefore(d, today) && isBefore(d, nextWeek);
  });
  const upcoming = withRevision.filter((p) => {
    const d = parseISO(p.next_revision_at!);
    return !isBefore(d, nextWeek);
  }).sort((a, b) => parseISO(a.next_revision_at!).getTime() - parseISO(b.next_revision_at!).getTime());
  const recent = progress
    .filter((p) => p.last_revised_at)
    .sort((a, b) => parseISO(b.last_revised_at!).getTime() - parseISO(a.last_revised_at!).getTime())
    .slice(0, 20);
  const weak = progress.filter((p) => p.is_weak);

  const SECTIONS: { id: RevSection; label: string; count: number; icon: any; color: string }[] = [
    { id: 'today',    label: 'Due Today',       count: dueToday.length,            icon: Calendar,      color: 'var(--warning)' },
    { id: 'overdue',  label: 'Overdue',          count: overdue.length,             icon: AlertTriangle, color: 'var(--error)' },
    { id: 'week',     label: 'This Week',        count: dueWeek.length,             icon: Clock,         color: 'var(--secondary)' },
    { id: 'upcoming', label: 'Upcoming',         count: upcoming.length,            icon: ChevronRight,  color: 'var(--text-muted)' },
    { id: 'recent',   label: 'Recently Revised', count: recent.length,              icon: CheckCircle,   color: 'var(--success)' },
    { id: 'history',  label: 'Session Logs',     count: revisionSessions.length,    icon: History,       color: 'var(--accent)' },
    { id: 'weak',     label: 'Weak Chapters',    count: weak.length,                icon: AlertTriangle, color: 'var(--error)' },
  ];

  const handleOpenRecordRevision = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setRevisionToEdit(null);
    setRevisionModalOpen(true);
  };

  const handleOpenEditSession = (session: SscRevisionSession) => {
    setSelectedChapterId(session.chapter_id);
    setRevisionToEdit(session);
    setRevisionModalOpen(true);
  };

  const handleRevisionSaved = async (saved: SscRevisionSession) => {
    showToast(revisionToEdit ? 'Revision updated!' : 'Revision session recorded!', 'success');
    await load();
    refreshContext();
  };

  const handleDismissRevision = async (chapterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await sscProgressService.clearNextRevision(user.id, chapterId);
      setProgress((prev) =>
        prev.map((p) => (p.chapter_id === chapterId ? { ...p, next_revision_at: null } : p))
      );
      showToast('Revision schedule cleared', 'info');
      refreshContext();
    } catch {
      showToast('Failed to clear revision', 'error');
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !reschedulingChapter) return;
    const formEl = e.currentTarget;
    const dateInput = formEl.elements.namedItem('newDate') as HTMLInputElement;
    if (!dateInput?.value) return;

    try {
      const newIso = new Date(dateInput.value).toISOString();
      await sscProgressService.upsert(user.id, reschedulingChapter.chapter_id, {
        next_revision_at: newIso,
      });
      setProgress((prev) =>
        prev.map((p) =>
          p.chapter_id === reschedulingChapter.chapter_id
            ? { ...p, next_revision_at: newIso }
            : p
        )
      );
      setReschedulingChapter(null);
      showToast('Revision rescheduled!', 'success');
      refreshContext();
    } catch {
      showToast('Failed to reschedule revision', 'error');
    }
  };

  const confirmDeleteSession = async () => {
    if (!deletingSession) return;
    try {
      await sscRevisionService.delete(deletingSession.id);
      setRevisionSessions((prev) => prev.filter((r) => r.id !== deletingSession.id));
      setDeletingSession(null);
      showToast('Revision record deleted', 'success');
      refreshContext();
    } catch {
      showToast('Failed to delete revision record', 'error');
    }
  };

  if (loading) return <LoadingState message="Loading revision centre…" />;

  return (
    <div className="ssc-page" style={{ animation: 'fadeIn 0.2s ease' }}>
      <div className="ssc-page-header">
        <div className="ssc-page-header-left">
          <RefreshCw size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Revision Centre</h1>
            <p className="page-subtitle">
              {overdue.length > 0
                ? `⚠ ${overdue.length} overdue · ${dueToday.length} due today`
                : dueToday.length > 0
                ? `${dueToday.length} due today`
                : 'All revisions up to date'}
            </p>
          </div>
        </div>
      </div>
      <SscNav />

      {/* Section tabs */}
      <div className="ssc-rev-tabs">
        {SECTIONS.map(({ id, label, count, icon: Icon, color }) => (
          <button
            key={id}
            className={`ssc-rev-tab${activeSection === id ? ' active' : ''}`}
            onClick={() => setActiveSection(id)}
          >
            <Icon size={13} style={{ color }} />
            {label}
            {count > 0 && (
              <span
                className={`ssc-badge ${
                  id === 'overdue' || id === 'weak'
                    ? 'ssc-badge-red'
                    : id === 'today'
                    ? 'ssc-badge-amber'
                    : 'ssc-badge-neutral'
                }`}
                style={{ marginLeft: '0.25rem' }}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Section Content: History Tab */}
      {activeSection === 'history' ? (
        revisionSessions.length === 0 ? (
          <div className="ssc-empty-card">
            <History size={32} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: '0.75rem' }} />
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>No revision sessions recorded yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {revisionSessions.map((rev) => {
              const chapter = chapterMap.get(rev.chapter_id);
              const subject = chapter ? subjectMap.get(chapter.subject_id) : null;
              const acc = rev.attempted && rev.correct
                ? Math.round((rev.correct / rev.attempted) * 100)
                : null;

              return (
                <div key={rev.id} className="card card-hover ssc-mock-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                      {chapter?.name ?? 'Unknown Chapter'}
                    </div>
                    <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                      {subject?.name} · {format(parseISO(rev.revision_date), 'd MMM yyyy')}
                      {rev.attempted !== null && ` · ${rev.attempted} questions`}
                      {acc !== null && ` (${acc}% accuracy)`}
                      {rev.confidence_rating && ` · Confidence: ${'★'.repeat(rev.confidence_rating)}`}
                    </div>
                    {rev.notes && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.3rem' }}>
                        {rev.notes}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', alignSelf: 'center' }}>
                    <button
                      className="btn btn-ghost ssc-btn-sm"
                      style={{ padding: '0.25rem 0.4rem' }}
                      onClick={() => handleOpenEditSession(rev)}
                      title="Edit revision record"
                      aria-label="Edit revision record"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn btn-ghost ssc-btn-sm"
                      style={{ padding: '0.25rem 0.4rem', color: 'var(--error)' }}
                      onClick={() => setDeletingSession(rev)}
                      title="Delete revision record"
                      aria-label="Delete revision record"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Chapter-based tabs */
        (() => {
          let items: SscChapterProgress[] = [];
          if (activeSection === 'today') items = dueToday;
          else if (activeSection === 'overdue') items = overdue.sort((a, b) => parseISO(a.next_revision_at!).getTime() - parseISO(b.next_revision_at!).getTime());
          else if (activeSection === 'week') items = dueWeek.sort((a, b) => parseISO(a.next_revision_at!).getTime() - parseISO(b.next_revision_at!).getTime());
          else if (activeSection === 'upcoming') items = upcoming;
          else if (activeSection === 'recent') items = recent;
          else if (activeSection === 'weak') items = weak;

          if (items.length === 0) {
            return (
              <div className="ssc-empty-card">
                <CheckCircle size={32} style={{ color: 'var(--success)', opacity: 0.5, marginBottom: '0.75rem' }} />
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  {activeSection === 'today' ? 'Nothing due for revision today. Great job!' :
                   activeSection === 'overdue' ? 'No overdue revisions!' :
                   activeSection === 'weak' ? 'No weak chapters. Keep it up!' :
                   'No items in this section.'}
                </p>
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {items.map((p) => {
                const chapter = chapterMap.get(p.chapter_id);
                const subject = chapter ? subjectMap.get(chapter.subject_id) : null;
                if (!chapter) return null;

                const isOD = p.next_revision_at ? isBefore(parseISO(p.next_revision_at), today) : false;
                const daysInfo = p.next_revision_at
                  ? differenceInDays(parseISO(p.next_revision_at), today)
                  : null;
                const accuracy = (p.questions_attempted ?? 0) > 0
                  ? Math.round((p.questions_correct / p.questions_attempted) * 100)
                  : null;

                return (
                  <div
                    key={p.chapter_id}
                    className="ssc-rev-row card card-hover"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem' }}
                  >
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                      onClick={() => navigate(`/ssc/chapters/${p.chapter_id}`)}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                        {chapter.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {subject?.name}
                        {accuracy !== null && ` · ${accuracy}% accuracy`}
                        {p.last_revised_at && ` · Last revised ${format(parseISO(p.last_revised_at), 'd MMM')}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', flexShrink: 0 }}>
                      <StatusBadge status={p.status} />
                      {p.next_revision_at && (
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: isOD ? 'var(--error)' : Math.abs(daysInfo ?? 0) <= 1 ? 'var(--warning)' : 'var(--text-muted)',
                        }}>
                          {isOD
                            ? `${Math.abs(daysInfo ?? 0)}d overdue`
                            : daysInfo === 0
                            ? 'Due today'
                            : `in ${daysInfo}d`}
                        </span>
                      )}
                      {p.is_weak && <span className="ssc-badge ssc-badge-red">Weak</span>}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                      <button
                        className="btn btn-primary ssc-btn-sm"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => handleOpenRecordRevision(p.chapter_id)}
                        title="Record a revision session"
                      >
                        <RefreshCw size={11} /> Revise
                      </button>

                      <button
                        className="btn btn-ghost ssc-btn-sm"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => setReschedulingChapter(p)}
                        title="Reschedule next revision date"
                      >
                        <Calendar size={12} />
                      </button>

                      {p.next_revision_at && (
                        <button
                          className="btn btn-ghost ssc-btn-sm"
                          style={{ padding: '0.25rem 0.5rem', color: 'var(--text-muted)' }}
                          onClick={(e) => handleDismissRevision(p.chapter_id, e)}
                          title="Clear next revision schedule"
                          aria-label="Clear next revision"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}

                      <button
                        className="btn btn-ghost ssc-btn-sm"
                        style={{ padding: '0.25rem' }}
                        onClick={() => navigate(`/ssc/chapters/${p.chapter_id}`)}
                        title="View chapter details"
                      >
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}

      {/* Revision Modal for Add/Edit */}
      {user && (
        <SscRevisionModal
          isOpen={revisionModalOpen}
          onClose={() => setRevisionModalOpen(false)}
          userId={user.id}
          chapterId={selectedChapterId}
          revisionToEdit={revisionToEdit}
          onSaved={handleRevisionSaved}
        />
      )}

      {/* Reschedule Dialog Modal */}
      {reschedulingChapter && (
        <div className="ssc-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ssc-modal" style={{ maxWidth: 400 }}>
            <div className="ssc-modal-header">
              <h2 className="ssc-modal-title">Reschedule Revision</h2>
            </div>
            <div className="ssc-modal-body">
              <form onSubmit={handleRescheduleSubmit}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Pick a new date for {chapterMap.get(reschedulingChapter.chapter_id)?.name}:
                </p>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="ssc-label">New Revision Date</label>
                  <input
                    type="date"
                    name="newDate"
                    required
                    className="ssc-input"
                    defaultValue={
                      reschedulingChapter.next_revision_at
                        ? reschedulingChapter.next_revision_at.split('T')[0]
                        : new Date().toISOString().split('T')[0]
                    }
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost ssc-btn-sm" onClick={() => setReschedulingChapter(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary ssc-btn-sm">
                    Save Schedule
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Revision Record Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingSession)}
        onCancel={() => setDeletingSession(null)}
        onConfirm={confirmDeleteSession}
        title="Delete Revision Record"
        message="Are you sure you want to delete this completed revision record? It will be removed from your revision history. (The chapter itself and your study progress will NOT be deleted.)"
        confirmLabel="Delete Record"
        danger
      />
    </div>
  );
}
