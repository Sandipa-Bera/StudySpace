import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { sscSubjectsService } from '../../services/ssc/sscSubjects.service';
import { sscChaptersService } from '../../services/ssc/sscChapters.service';
import { sscProgressService } from '../../services/ssc/sscProgress.service';
import { SscNav } from '../../components/ssc/SscNav';
import { StatusBadge } from '../../components/ssc/SscBadges';
import { LoadingState } from '../../components/ui/LoadingState';
import type {
  SscSubject,
  SscChapter,
  SscChapterProgress,
  ChapterStatus,
} from '../../types/ssc.types';
import { ChevronRight, BookOpen } from 'lucide-react';
import { isBefore, parseISO } from 'date-fns';

export function SscSubjectPage() {
  const { subjectSlug } = useParams<{ subjectSlug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [subject, setSubject] = useState<SscSubject | null>(null);
  const [chapters, setChapters] = useState<SscChapter[]>([]);
  const [progress, setProgress] = useState<SscChapterProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !subjectSlug) return;
    (async () => {
      setLoading(true);
      try {
        const sub = await sscSubjectsService.getBySlug(subjectSlug);
        if (!sub) { navigate('/ssc/syllabus'); return; }
        const [chs, prog] = await Promise.all([
          sscChaptersService.getBySubject(sub.id),
          sscProgressService.getAllForUser(user.id),
        ]);
        setSubject(sub);
        setChapters(chs);
        setProgress(prog.filter((p) => chs.some((c) => c.id === p.chapter_id)));
      } catch {
        showToast('Failed to load subject', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, subjectSlug]);

  const progressMap = useMemo(
    () => new Map(progress.map((p) => [p.chapter_id, p])),
    [progress]
  );

  const totalQB = chapters.reduce((s, c) => s + c.question_bank_count, 0);
  const totalAttempted = progress.reduce((s, p) => s + (p.questions_attempted ?? 0), 0);
  const totalCorrect   = progress.reduce((s, p) => s + (p.questions_correct ?? 0), 0);
  const subAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const completedCount = progress.filter((p) => p.status === 'completed').length;
  const pct = chapters.length > 0 ? Math.round((completedCount / chapters.length) * 100) : 0;

  if (loading) return <LoadingState message="Loading subject…" />;
  if (!subject) return null;

  return (
    <div className="ssc-page" style={{ animation: 'fadeIn 0.2s ease' }}>
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <button onClick={() => navigate('/ssc')}>SSC CGL</button>
        <span className="breadcrumb-sep">›</span>
        <button onClick={() => navigate('/ssc/syllabus')}>Syllabus</button>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{subject.name}</span>
      </nav>

      <div className="ssc-page-header">
        <div className="ssc-page-header-left">
          <BookOpen size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{subject.name}</h1>
            <p className="page-subtitle">
              {chapters.length} chapters · {totalQB.toLocaleString()} questions in bank
              {subAccuracy > 0 && ` · ${subAccuracy}% accuracy`}
            </p>
          </div>
        </div>
      </div>

      <SscNav />

      {/* Summary bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Subject Completion</span>
          <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'Lora, serif' }}>{pct}%</span>
        </div>
        <div className="progress-track" style={{ height: 8, marginBottom: '0.75rem' }}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="ssc-subject-mini-stats" style={{ justifyContent: 'flex-start', gap: '1.5rem' }}>
          <span style={{ color: 'var(--success)' }}>✓ {completedCount} completed</span>
          <span style={{ color: 'var(--secondary)' }}>◑ {progress.filter((p) => p.status === 'in_progress').length} in progress</span>
          <span style={{ color: 'var(--text-muted)' }}>○ {chapters.length - progress.length + progress.filter((p) => p.status === 'not_started').length} not started</span>
          {progress.filter((p) => p.is_weak).length > 0 && (
            <span style={{ color: 'var(--error)' }}>⚠ {progress.filter((p) => p.is_weak).length} weak</span>
          )}
        </div>
      </div>

      {/* Chapter list */}
      <div className="ssc-compact-list">
        {chapters.map((ch, idx) => {
          const p = progressMap.get(ch.id) ?? null;
          const status = p?.status ?? 'not_started';
          const acc = (p?.questions_attempted ?? 0) > 0
            ? Math.round((p!.questions_correct / p!.questions_attempted) * 100)
            : null;
          const isOverdue = p?.next_revision_at
            ? isBefore(parseISO(p.next_revision_at), new Date())
            : false;

          return (
            <div
              key={ch.id}
              className="ssc-chapter-list-row card card-hover"
              onClick={() => navigate(`/ssc/chapters/${ch.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/ssc/chapters/${ch.id}`)}
            >
              <div className="ssc-ch-row-num">{idx + 1}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                  {ch.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span>{ch.question_bank_count} QB questions</span>
                  {p?.questions_attempted ? <span>{p.questions_attempted} attempted</span> : null}
                  {acc !== null && <span>{acc}% accuracy</span>}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                {p?.is_weak && <span className="ssc-badge ssc-badge-red">Weak</span>}
                {isOverdue && <span className="ssc-badge ssc-badge-red">Overdue</span>}
                <StatusBadge status={status} />
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
