import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useSscData } from '../../context/SscDataContext';
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
import { BookOpen, Search, Filter, ChevronRight, LayoutGrid, List, AlignLeft } from 'lucide-react';
import { isBefore, parseISO } from 'date-fns';

type SortKey = 'name' | 'question_bank_count' | 'status' | 'accuracy';
type ViewMode = 'table' | 'card' | 'compact';

export function SscSyllabusPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { refresh: refreshContext } = useSscData();

  const [subjects, setSubjects] = useState<SscSubject[]>([]);
  const [chapters, setChapters] = useState<SscChapter[]>([]);
  const [progress, setProgress] = useState<SscChapterProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const initialStatus = searchParams.get('status') as ChapterStatus | null;

  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState<ChapterStatus | ''>(
    initialStatus && ['not_started', 'in_progress', 'completed', 'revise'].includes(initialStatus)
      ? initialStatus
      : ''
  );
  const [filterWeak, setFilterWeak] = useState(false);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  useEffect(() => {
    const s = searchParams.get('status') as ChapterStatus | null;
    if (s && ['not_started', 'in_progress', 'completed', 'revise'].includes(s)) {
      setFilterStatus(s);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [subs, chs, prog] = await Promise.all([
          sscSubjectsService.getAll(),
          sscChaptersService.getAll(),
          sscProgressService.getAllForUser(user.id),
        ]);
        setSubjects(subs);
        setChapters(chs);
        setProgress(prog);
      } catch {
        showToast('Failed to load syllabus', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const progressMap = useMemo(
    () => new Map(progress.map((p) => [p.chapter_id, p])),
    [progress]
  );

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  const filtered = useMemo(() => {
    const today = new Date();
    return chapters
      .filter((ch) => {
        const p = progressMap.get(ch.id);
        if (search && !ch.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterSubject && ch.subject_id !== filterSubject) return false;
        if (filterStatus && (p?.status ?? 'not_started') !== filterStatus) return false;
        if (filterWeak && !p?.is_weak) return false;
        if (filterOverdue) {
          if (!p?.next_revision_at) return false;
          if (!isBefore(parseISO(p.next_revision_at), today)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const pa = progressMap.get(a.id);
        const pb = progressMap.get(b.id);
        switch (sortKey) {
          case 'name': return a.name.localeCompare(b.name);
          case 'question_bank_count': return b.question_bank_count - a.question_bank_count;
          case 'status': {
            const order: Record<ChapterStatus, number> = { in_progress: 0, revise: 1, not_started: 2, completed: 3 };
            return (order[pa?.status ?? 'not_started']) - (order[pb?.status ?? 'not_started']);
          }
          case 'accuracy': {
            const accA = (pa?.questions_attempted ?? 0) > 0 ? (pa!.questions_correct / pa!.questions_attempted) : -1;
            const accB = (pb?.questions_attempted ?? 0) > 0 ? (pb!.questions_correct / pb!.questions_attempted) : -1;
            return accB - accA;
          }
          default: return a.display_order - b.display_order;
        }
      });
  }, [chapters, progressMap, search, filterSubject, filterStatus, filterWeak, filterOverdue, sortKey]);

  if (loading) return <LoadingState message="Loading syllabus…" />;

  return (
    <div className="ssc-page" style={{ animation: 'fadeIn 0.2s ease' }}>
      <div className="ssc-page-header">
        <div className="ssc-page-header-left">
          <BookOpen size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Syllabus</h1>
            <p className="page-subtitle">{chapters.length} chapters across {subjects.length} subjects</p>
          </div>
        </div>
      </div>

      <SscNav />

      {/* ── Subject quick-nav ── */}
      <div className="ssc-subject-tabs">
        <button
          className={`ssc-subject-tab${!filterSubject ? ' active' : ''}`}
          onClick={() => setFilterSubject('')}
        >
          All ({chapters.length})
        </button>
        {subjects.map((s) => {
          const count = chapters.filter((c) => c.subject_id === s.id).length;
          return (
            <button
              key={s.id}
              className={`ssc-subject-tab${filterSubject === s.id ? ' active' : ''}`}
              onClick={() => setFilterSubject(s.id)}
            >
              {s.name} ({count})
            </button>
          );
        })}
      </div>

      {/* ── Filters & search bar ── */}
      <div className="ssc-toolbar">
        <div className="ssc-search-box">
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            className="ssc-search-input"
            placeholder="Search chapters…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="ssc-filter-row">
          <select
            className="ssc-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ChapterStatus | '')}
          >
            <option value="">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="revise">Revise</option>
          </select>

          <select
            className="ssc-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="name">Sort: Name</option>
            <option value="question_bank_count">Sort: QB Count</option>
            <option value="status">Sort: Status</option>
            <option value="accuracy">Sort: Accuracy</option>
          </select>

          <label className="ssc-filter-chip">
            <input type="checkbox" checked={filterWeak} onChange={(e) => setFilterWeak(e.target.checked)} />
            Weak
          </label>
          <label className="ssc-filter-chip">
            <input type="checkbox" checked={filterOverdue} onChange={(e) => setFilterOverdue(e.target.checked)} />
            Overdue
          </label>
        </div>

        <div className="ssc-view-toggle">
          {([['card', LayoutGrid], ['table', AlignLeft], ['compact', List]] as const).map(([mode, Icon]) => (
            <button
              key={mode}
              className={`ssc-view-btn${viewMode === mode ? ' active' : ''}`}
              onClick={() => setViewMode(mode)}
              aria-label={`${mode} view`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Showing {filtered.length} of {chapters.length} chapters
      </p>

      {/* ── Chapter list ── */}
      {filtered.length === 0 ? (
        <div className="ssc-empty-card">
          <p style={{ color: 'var(--text-muted)' }}>No chapters match your filters.</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="ssc-chapter-grid">
          {filtered.map((ch) => (
            <ChapterCard
              key={ch.id}
              chapter={ch}
              subject={subjectMap.get(ch.subject_id)}
              progress={progressMap.get(ch.id) ?? null}
              onClick={() => navigate(`/ssc/chapters/${ch.id}`)}
            />
          ))}
        </div>
      ) : viewMode === 'table' ? (
        <div className="ssc-table-wrap">
          <table className="ssc-table">
            <thead>
              <tr>
                <th>Chapter</th>
                <th>Subject</th>
                <th>QB Count</th>
                <th>Status</th>
                <th>Attempted</th>
                <th>Accuracy</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ch) => {
                const p = progressMap.get(ch.id) ?? null;
                const acc = (p?.questions_attempted ?? 0) > 0
                  ? Math.round((p!.questions_correct / p!.questions_attempted) * 100)
                  : null;
                return (
                  <tr key={ch.id} className="ssc-table-row" onClick={() => navigate(`/ssc/chapters/${ch.id}`)}>
                    <td style={{ fontWeight: 600 }}>{ch.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{subjectMap.get(ch.subject_id)?.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{ch.question_bank_count}</td>
                    <td><StatusBadge status={p?.status ?? 'not_started'} /></td>
                    <td>{p?.questions_attempted ?? 0}</td>
                    <td>{acc !== null ? `${acc}%` : '—'}</td>
                    <td><ChevronRight size={14} style={{ color: 'var(--text-muted)' }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* compact */
        <div className="ssc-compact-list">
          {filtered.map((ch) => {
            const p = progressMap.get(ch.id) ?? null;
            return (
              <div
                key={ch.id}
                className="ssc-compact-row"
                onClick={() => navigate(`/ssc/chapters/${ch.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/ssc/chapters/${ch.id}`)}
              >
                <StatusBadge status={p?.status ?? 'not_started'} />
                <span style={{ flex: 1, fontWeight: 500, fontSize: '0.875rem' }}>{ch.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {subjectMap.get(ch.subject_id)?.name}
                </span>
                <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Chapter card sub-component ──────────────────────────────

function ChapterCard({
  chapter,
  subject,
  progress,
  onClick,
}: {
  chapter: SscChapter;
  subject?: SscSubject;
  progress: SscChapterProgress | null;
  onClick: () => void;
}) {
  const status = progress?.status ?? 'not_started';
  const accuracy = (progress?.questions_attempted ?? 0) > 0
    ? Math.round((progress!.questions_correct / progress!.questions_attempted) * 100)
    : null;
  const isOverdue = progress?.next_revision_at
    ? isBefore(parseISO(progress.next_revision_at), new Date())
    : false;

  const borderColor =
    status === 'completed' ? 'var(--success)' :
    status === 'in_progress' ? 'var(--secondary)' :
    status === 'revise' ? 'var(--warning)' :
    'var(--border)';

  return (
    <div
      className="ssc-chapter-card card card-hover"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div style={{ marginBottom: '0.625rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
          {chapter.name}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {subject?.name} · {chapter.question_bank_count} questions
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
        <StatusBadge status={status} />
        {progress?.is_weak && <span className="ssc-badge ssc-badge-red">Weak</span>}
        {isOverdue && <span className="ssc-badge ssc-badge-red">Overdue</span>}
        {progress?.priority_override && (
          <span className={`ssc-badge ssc-badge-${progress.priority_override === 'high' ? 'red' : progress.priority_override === 'medium' ? 'amber' : 'neutral'}`}>
            {progress.priority_override} priority
          </span>
        )}
      </div>

      {accuracy !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div className="progress-track" style={{ flex: 1, height: 4 }}>
            <div
              className="progress-fill"
              style={{
                width: `${accuracy}%`,
                background: accuracy >= 80 ? 'var(--success)' : accuracy >= 60 ? 'var(--warning)' : 'var(--error)',
              }}
            />
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{accuracy}%</span>
        </div>
      )}

      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {progress?.questions_attempted ? (
          <span>{progress.questions_attempted} attempted</span>
        ) : null}
        {progress?.confidence_rating && (
          <span>{'★'.repeat(progress.confidence_rating)} confidence</span>
        )}
      </div>
    </div>
  );
}
