import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { sscSubjectsService } from '../../services/ssc/sscSubjects.service';
import { sscChaptersService } from '../../services/ssc/sscChapters.service';
import { sscProgressService } from '../../services/ssc/sscProgress.service';
import { sscSettingsService } from '../../services/ssc/sscSettings.service';
import { SscNav } from '../../components/ssc/SscNav';
import { StatusBadge, PriorityBadge } from '../../components/ssc/SscBadges';
import { LoadingState } from '../../components/ui/LoadingState';
import type {
  SscSubject,
  SscChapter,
  SscChapterProgress,
  SscUserSettings,
  PriorityLevel,
} from '../../types/ssc.types';
import { Target, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { isBefore, parseISO, differenceInDays } from 'date-fns';

interface RankedChapter {
  chapter: SscChapter;
  subject: SscSubject;
  progress: SscChapterProgress | null;
  priority_score: number;
  priority_level: PriorityLevel;
  reasons: string[];
}

function computePriorityScore(
  chapter: SscChapter,
  progress: SscChapterProgress | null,
  weights: SscUserSettings['priority_weights']
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  // 1. Weakness (0-1)
  const accuracy = (progress?.questions_attempted ?? 0) > 0
    ? (progress!.questions_correct / progress!.questions_attempted)
    : null;
  const weaknessScore = accuracy !== null ? 1 - accuracy : 0.5; // unknown = medium
  if (weaknessScore > 0.6) reasons.push('Low accuracy');

  // 2. Revision urgency (0-1)
  let revisionScore = 0;
  if (progress?.next_revision_at) {
    const daysOverdue = differenceInDays(new Date(), parseISO(progress.next_revision_at));
    if (daysOverdue > 0) {
      revisionScore = Math.min(1, daysOverdue / 14);
      reasons.push(`${daysOverdue} days overdue`);
    }
  } else if (progress?.last_studied_at) {
    const daysSinceStudy = differenceInDays(new Date(), parseISO(progress.last_studied_at));
    if (daysSinceStudy > 7) {
      revisionScore = Math.min(0.5, daysSinceStudy / 30);
      reasons.push('Not revised recently');
    }
  }

  // 3. Exam relevance placeholder (0-1)
  // Without verified data we use question_bank_count as a soft proxy (normalised)
  const maxQB = 357; // Static GK
  const relevanceScore = Math.min(1, chapter.question_bank_count / maxQB);

  // 4. Dependency / incompleteness (0-1)
  let depScore = 0;
  const status = progress?.status ?? 'not_started';
  if (status === 'not_started') { depScore = 0.8; reasons.push('Not started'); }
  else if (status === 'in_progress') { depScore = 0.5; reasons.push('In progress'); }
  else if (status === 'revise') { depScore = 0.4; reasons.push('Needs revision'); }

  // Weighted sum
  const score =
    (relevanceScore * weights.exam_relevance +
     weaknessScore  * weights.weakness +
     revisionScore  * weights.revision_urgency +
     depScore       * weights.dependency) / 100;

  return { score: Math.round(score * 100), reasons };
}

export function SscPriorityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [subjects, setSubjects] = useState<SscSubject[]>([]);
  const [chapters, setChapters] = useState<SscChapter[]>([]);
  const [progress, setProgress] = useState<SscChapterProgress[]>([]);
  const [settings, setSettings] = useState<SscUserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState<PriorityLevel | ''>('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [subs, chs, prog, sett] = await Promise.all([
          sscSubjectsService.getAll(),
          sscChaptersService.getAll(),
          sscProgressService.getAllForUser(user.id),
          sscSettingsService.get(user.id),
        ]);
        setSubjects(subs);
        setChapters(chs);
        setProgress(prog);
        setSettings(sett);
      } catch { showToast('Failed to load priority board', 'error'); }
      finally { setLoading(false); }
    })();
  }, [user]);

  const ranked: RankedChapter[] = useMemo(() => {
    if (!settings) return [];
    const progMap = new Map(progress.map((p) => [p.chapter_id, p]));
    const subMap = new Map(subjects.map((s) => [s.id, s]));

    return chapters
      .map((ch) => {
        const prog = progMap.get(ch.id) ?? null;
        const subject = subMap.get(ch.subject_id)!;
        const { score, reasons } = computePriorityScore(ch, prog, settings.priority_weights);
        const priority_override = prog?.priority_override;
        let priority_level: PriorityLevel =
          priority_override ?? (score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low');
        return { chapter: ch, subject, progress: prog, priority_score: score, priority_level, reasons };
      })
      .filter((r) => !filterPriority || r.priority_level === filterPriority)
      .sort((a, b) => b.priority_score - a.priority_score);
  }, [chapters, subjects, progress, settings, filterPriority]);

  const high   = ranked.filter((r) => r.priority_level === 'high');
  const medium = ranked.filter((r) => r.priority_level === 'medium');
  const low    = ranked.filter((r) => r.priority_level === 'low');

  if (loading) return <LoadingState message="Computing priority board…" />;

  return (
    <div className="ssc-page" style={{ animation: 'fadeIn 0.2s ease' }}>
      <div className="ssc-page-header">
        <div className="ssc-page-header-left">
          <Target size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Priority Board</h1>
            <p className="page-subtitle">Chapters ranked by preparation urgency</p>
          </div>
        </div>
      </div>
      <SscNav />

      <div className="ssc-alert" style={{ marginBottom: '1rem' }}>
        ⚠ Exam relevance scores are unverified estimates based on question-bank size. Configure verified weights in <button className="ssc-link" onClick={() => navigate('/ssc/settings')}>SSC Settings</button>.
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {(['', 'high', 'medium', 'low'] as const).map((p) => (
          <button
            key={String(p)}
            className={`btn ssc-btn-sm ${filterPriority === p ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilterPriority(p)}
          >
            {p ? p.charAt(0).toUpperCase() + p.slice(1) : `All (${ranked.length})`}
          </button>
        ))}
      </div>

      {/* High priority */}
      {(filterPriority === '' || filterPriority === 'high') && high.length > 0 && (
        <section className="ssc-section">
          <h2 className="ssc-section-title" style={{ color: 'var(--error)' }}>
            🔴 High Priority ({high.length})
          </h2>
          <PriorityList items={high} navigate={navigate} />
        </section>
      )}

      {/* Medium */}
      {(filterPriority === '' || filterPriority === 'medium') && medium.length > 0 && (
        <section className="ssc-section">
          <h2 className="ssc-section-title" style={{ color: 'var(--warning)' }}>
            🟡 Medium Priority ({medium.length})
          </h2>
          <PriorityList items={medium} navigate={navigate} />
        </section>
      )}

      {/* Low */}
      {(filterPriority === '' || filterPriority === 'low') && low.length > 0 && (
        <section className="ssc-section">
          <h2 className="ssc-section-title" style={{ color: 'var(--text-muted)' }}>
            ⚪ Low Priority ({low.length})
          </h2>
          <PriorityList items={low} navigate={navigate} />
        </section>
      )}

      {ranked.length === 0 && (
        <div className="ssc-empty-card">
          <p style={{ color: 'var(--text-muted)' }}>No chapters found. Run the database migration to seed syllabus data.</p>
        </div>
      )}
    </div>
  );
}

function PriorityList({
  items,
  navigate,
}: {
  items: RankedChapter[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {items.map(({ chapter, subject, progress: prog, priority_score, priority_level, reasons }) => {
        const status = prog?.status ?? 'not_started';
        const isOverdue = prog?.next_revision_at
          ? isBefore(parseISO(prog.next_revision_at), new Date())
          : false;
        const accuracy = (prog?.questions_attempted ?? 0) > 0
          ? Math.round((prog!.questions_correct / prog!.questions_attempted) * 100)
          : null;

        return (
          <div
            key={chapter.id}
            className="ssc-priority-row card card-hover"
            onClick={() => navigate(`/ssc/chapters/${chapter.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/ssc/chapters/${chapter.id}`)}
          >
            <div className="ssc-priority-score">
              <span style={{
                fontWeight: 800, fontSize: '1.1rem', fontFamily: 'Lora, serif',
                color: priority_level === 'high' ? 'var(--error)' : priority_level === 'medium' ? 'var(--warning)' : 'var(--text-muted)',
              }}>
                {priority_score}
              </span>
              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>score</span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{chapter.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                {subject.name} · {chapter.question_bank_count} QB questions
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {reasons.map((r, i) => (
                  <span key={i} className="ssc-badge ssc-badge-neutral" style={{ fontSize: '0.65rem' }}>
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
              <StatusBadge status={status} />
              {accuracy !== null && (
                <span style={{ fontSize: '0.7rem', color: accuracy >= 80 ? 'var(--success)' : accuracy >= 60 ? 'var(--warning)' : 'var(--error)' }}>
                  {accuracy}% acc
                </span>
              )}
              {isOverdue && <span className="ssc-badge ssc-badge-red">Overdue</span>}
              {prog?.priority_override && (
                <span className="ssc-badge ssc-badge-blue" style={{ fontSize: '0.65rem' }}>manual</span>
              )}
            </div>

            <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        );
      })}
    </div>
  );
}
