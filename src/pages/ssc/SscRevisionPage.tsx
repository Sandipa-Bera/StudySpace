import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { sscSubjectsService } from '../../services/ssc/sscSubjects.service';
import { sscChaptersService } from '../../services/ssc/sscChapters.service';
import { sscProgressService } from '../../services/ssc/sscProgress.service';
import { sscRevisionService } from '../../services/ssc/sscRevision.service';
import { SscNav } from '../../components/ssc/SscNav';
import { StatusBadge } from '../../components/ssc/SscBadges';
import { LoadingState } from '../../components/ui/LoadingState';
import type {
  SscSubject,
  SscChapter,
  SscChapterProgress,
} from '../../types/ssc.types';
import { RefreshCw, AlertTriangle, Clock, CheckCircle, ChevronRight, Calendar } from 'lucide-react';
import { format, parseISO, isBefore, isToday, addDays, differenceInDays } from 'date-fns';

type RevSection = 'today' | 'overdue' | 'week' | 'upcoming' | 'recent' | 'weak';

export function SscRevisionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [subjects, setSubjects] = useState<SscSubject[]>([]);
  const [chapters, setChapters] = useState<SscChapter[]>([]);
  const [progress, setProgress] = useState<SscChapterProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<RevSection>('today');

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
      } catch { showToast('Failed to load revision centre', 'error'); }
      finally { setLoading(false); }
    })();
  }, [user]);

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
    { id: 'today',    label: 'Due Today',       count: dueToday.length,  icon: Calendar,       color: 'var(--warning)' },
    { id: 'overdue',  label: 'Overdue',          count: overdue.length,   icon: AlertTriangle,  color: 'var(--error)' },
    { id: 'week',     label: 'This Week',        count: dueWeek.length,   icon: Clock,          color: 'var(--secondary)' },
    { id: 'upcoming', label: 'Upcoming',         count: upcoming.length,  icon: ChevronRight,   color: 'var(--text-muted)' },
    { id: 'recent',   label: 'Recently Revised', count: recent.length,    icon: CheckCircle,    color: 'var(--success)' },
    { id: 'weak',     label: 'Weak Chapters',    count: weak.length,      icon: AlertTriangle,  color: 'var(--error)' },
  ];

  const getItems = (): SscChapterProgress[] => {
    switch (activeSection) {
      case 'today':    return dueToday;
      case 'overdue':  return overdue.sort((a, b) => parseISO(a.next_revision_at!).getTime() - parseISO(b.next_revision_at!).getTime());
      case 'week':     return dueWeek.sort((a, b) => parseISO(a.next_revision_at!).getTime() - parseISO(b.next_revision_at!).getTime());
      case 'upcoming': return upcoming;
      case 'recent':   return recent;
      case 'weak':     return weak;
      default:         return [];
    }
  };

  if (loading) return <LoadingState message="Loading revision centre…" />;

  const items = getItems();

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
              <span className={`ssc-badge ${id === 'overdue' || id === 'weak' ? 'ssc-badge-red' : id === 'today' ? 'ssc-badge-amber' : 'ssc-badge-neutral'}`} style={{ marginLeft: '0.25rem' }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="ssc-empty-card">
          <CheckCircle size={32} style={{ color: 'var(--success)', opacity: 0.5, marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            {activeSection === 'today' ? 'Nothing due for revision today. Great job!' :
             activeSection === 'overdue' ? 'No overdue revisions!' :
             activeSection === 'weak' ? 'No weak chapters. Keep it up!' :
             'No items in this section.'}
          </p>
        </div>
      ) : (
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
                onClick={() => navigate(`/ssc/chapters/${p.chapter_id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/ssc/chapters/${p.chapter_id}`)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
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

                <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
