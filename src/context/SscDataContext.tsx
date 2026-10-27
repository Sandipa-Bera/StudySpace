/**
 * SscDataContext
 *
 * Provides shared SSC CGL data (subjects, chapters, progress) to all SSC pages
 * and the homepage widget. Using a context means edits in one page are
 * immediately visible everywhere — no manual refresh needed.
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { sscSubjectsService } from '../services/ssc/sscSubjects.service';
import { sscChaptersService } from '../services/ssc/sscChapters.service';
import { sscProgressService } from '../services/ssc/sscProgress.service';
import type { SscSubject, SscChapter, SscChapterProgress, DashboardStats, SscSubjectStats } from '../types/ssc.types';
import { isBefore, parseISO } from 'date-fns';

interface SscDataContextValue {
  subjects: SscSubject[];
  chapters: SscChapter[];
  progress: SscChapterProgress[];
  loading: boolean;
  dashboardStats: DashboardStats | null;
  refresh: () => Promise<void>;
  updateProgress: (p: SscChapterProgress) => void;
  removeProgress: (chapterId: string) => void;
  progressMap: Map<string, SscChapterProgress>;
}

const SscDataContext = createContext<SscDataContextValue | null>(null);

export function SscDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<SscSubject[]>([]);
  const [chapters, setChapters] = useState<SscChapter[]>([]);
  const [progress, setProgress] = useState<SscChapterProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
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
    } catch (err) {
      console.error('[SscDataContext] failed to load', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const updateProgress = useCallback((p: SscChapterProgress) => {
    setProgress((prev) => {
      const idx = prev.findIndex((x) => x.chapter_id === p.chapter_id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = p;
        return copy;
      }
      return [...prev, p];
    });
  }, []);

  const removeProgress = useCallback((chapterId: string) => {
    setProgress((prev) => prev.filter((p) => p.chapter_id !== chapterId));
  }, []);

  const progressMap = useMemo(
    () => new Map(progress.map((p) => [p.chapter_id, p])),
    [progress]
  );

  const dashboardStats = useMemo((): DashboardStats | null => {
    if (subjects.length === 0) return null;
    const today = new Date();
    let totalAttempted = 0, totalCorrect = 0;

    const subject_stats: SscSubjectStats[] = subjects.map((sub) => {
      const subChapters = chapters.filter((c) => c.subject_id === sub.id);
      let notStarted = 0, inProgress = 0, completed = 0, revise = 0, weak = 0, overdue = 0;
      let subAttempted = 0, subCorrect = 0;

      for (const ch of subChapters) {
        const p = progressMap.get(ch.id);
        const status = p?.status ?? 'not_started';
        if (status === 'not_started') notStarted++;
        else if (status === 'in_progress') inProgress++;
        else if (status === 'completed') completed++;
        else if (status === 'revise') revise++;
        if (p?.is_weak) weak++;
        if (p?.next_revision_at && isBefore(parseISO(p.next_revision_at), today)) overdue++;
        subAttempted += p?.questions_attempted ?? 0;
        subCorrect   += p?.questions_correct ?? 0;
      }
      totalAttempted += subAttempted;
      totalCorrect   += subCorrect;

      return {
        subject: sub,
        total_chapters: subChapters.length,
        not_started: notStarted,
        in_progress: inProgress,
        completed,
        revise,
        weak,
        overdue,
        completion_pct: subChapters.length > 0 ? Math.round((completed / subChapters.length) * 100) : 0,
        accuracy: subAttempted > 0 ? Math.round((subCorrect / subAttempted) * 100) : 0,
        questions_attempted: subAttempted,
      };
    });

    const totals = subject_stats.reduce(
      (acc, ss) => ({
        not_started: acc.not_started + ss.not_started,
        in_progress: acc.in_progress + ss.in_progress,
        completed:   acc.completed   + ss.completed,
        revise:      acc.revise      + ss.revise,
        weak:        acc.weak        + ss.weak,
        overdue:     acc.overdue     + ss.overdue,
      }),
      { not_started: 0, in_progress: 0, completed: 0, revise: 0, weak: 0, overdue: 0 }
    );

    return {
      total_subjects: subjects.length,
      total_chapters: chapters.length,
      overall_accuracy: totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0,
      total_attempted: totalAttempted,
      subject_stats,
      ...totals,
    };
  }, [subjects, chapters, progressMap]);

  return (
    <SscDataContext.Provider value={{
      subjects, chapters, progress, loading,
      dashboardStats, refresh, updateProgress, removeProgress, progressMap,
    }}>
      {children}
    </SscDataContext.Provider>
  );
}

export function useSscData() {
  const ctx = useContext(SscDataContext);
  if (!ctx) throw new Error('useSscData must be used inside SscDataProvider');
  return ctx;
}
