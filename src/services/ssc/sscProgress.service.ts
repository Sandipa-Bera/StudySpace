import { supabase } from '../../lib/supabase';
import { addDays, isAfter, isBefore, parseISO, startOfToday } from 'date-fns';
import type {
  SscChapterProgress,
  ChapterProgressForm,
  ChapterStatus,
} from '../../types/ssc.types';

export const sscProgressService = {
  // ── Read ────────────────────────────────────────────────

  async getAllForUser(userId: string): Promise<SscChapterProgress[]> {
    const { data, error } = await supabase
      .from('ssc_chapter_progress')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data ?? [];
  },

  async getForChapter(
    userId: string,
    chapterId: string
  ): Promise<SscChapterProgress | null> {
    const { data, error } = await supabase
      .from('ssc_chapter_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('chapter_id', chapterId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ── Upsert (create or update) ───────────────────────────

  async upsert(
    userId: string,
    chapterId: string,
    updates: Partial<ChapterProgressForm> & { status?: ChapterStatus }
  ): Promise<SscChapterProgress> {
    const now = new Date().toISOString();

    // Fetch existing row first
    const existing = await this.getForChapter(userId, chapterId);

    const payload: Record<string, unknown> = {
      user_id: userId,
      chapter_id: chapterId,
      updated_at: now,
      ...updates,
    };

    // Auto-set last_studied_at when status changes to in_progress or completed
    if (
      (updates.status === 'in_progress' || updates.status === 'completed') &&
      !existing?.last_studied_at
    ) {
      payload.last_studied_at = now;
    }
    if (updates.status === 'completed' && existing?.status !== 'completed') {
      payload.last_studied_at = now;
    }

    const { data, error } = await supabase
      .from('ssc_chapter_progress')
      .upsert(payload, { onConflict: 'user_id,chapter_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ── Status shortcuts ────────────────────────────────────

  async setStatus(
    userId: string,
    chapterId: string,
    status: ChapterStatus
  ): Promise<SscChapterProgress> {
    return this.upsert(userId, chapterId, { status });
  },

  async setChecklist(
    userId: string,
    chapterId: string,
    field: 'learning_done' | 'notes_prepared' | 'practice_done',
    value: boolean
  ): Promise<SscChapterProgress> {
    return this.upsert(userId, chapterId, { [field]: value });
  },

  async setNotes(
    userId: string,
    chapterId: string,
    notes: string
  ): Promise<SscChapterProgress> {
    return this.upsert(userId, chapterId, { personal_notes: notes });
  },

  async setConfidence(
    userId: string,
    chapterId: string,
    rating: number
  ): Promise<SscChapterProgress> {
    return this.upsert(userId, chapterId, { confidence_rating: rating });
  },

  async setPriorityOverride(
    userId: string,
    chapterId: string,
    priority: 'high' | 'medium' | 'low' | null
  ): Promise<SscChapterProgress> {
    return this.upsert(userId, chapterId, { priority_override: priority });
  },

  async resetProgress(
    userId: string,
    chapterId: string
  ): Promise<SscChapterProgress> {
    return this.upsert(userId, chapterId, {
      status: 'not_started',
      learning_done: false,
      notes_prepared: false,
      practice_done: false,
      confidence_rating: null,
      priority_override: null,
      next_revision_at: null,
    });
  },

  async deleteNotes(
    userId: string,
    chapterId: string
  ): Promise<SscChapterProgress> {
    return this.upsert(userId, chapterId, { personal_notes: null });
  },

  async clearNextRevision(
    userId: string,
    chapterId: string
  ): Promise<SscChapterProgress> {
    return this.upsert(userId, chapterId, { next_revision_at: null });
  },

  async deleteProgress(
    userId: string,
    chapterId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('ssc_chapter_progress')
      .delete()
      .eq('user_id', userId)
      .eq('chapter_id', chapterId);
    if (error) throw error;
  },

  // ── Aggregate practice stats into progress ──────────────

  async recalcFromPractice(
    userId: string,
    chapterId: string
  ): Promise<void> {
    const { data: sessions, error } = await supabase
      .from('ssc_practice_sessions')
      .select('attempted, correct')
      .eq('user_id', userId)
      .eq('chapter_id', chapterId);

    if (error) throw error;
    if (!sessions || sessions.length === 0) return;

    const total_attempted = sessions.reduce((s, r) => s + (r.attempted ?? 0), 0);
    const total_correct   = sessions.reduce((s, r) => s + (r.correct ?? 0), 0);
    const accuracy = total_attempted > 0 ? (total_correct / total_attempted) * 100 : 0;
    const is_weak = total_attempted > 0 && accuracy < 60;

    await this.upsert(userId, chapterId, {
      questions_attempted: total_attempted,
      questions_correct: total_correct,
      is_weak,
    } as any);
  },

  // ── Revision scheduling ─────────────────────────────────

  async scheduleNextRevision(
    userId: string,
    chapterId: string,
    intervals: number[],
    revisionIndex: number,
    accuracy?: number,
    confidence?: number
  ): Promise<void> {
    const baseInterval = intervals[Math.min(revisionIndex, intervals.length - 1)] ?? 30;

    // Adaptive adjustment
    let interval = baseInterval;
    if (accuracy !== undefined && confidence !== undefined) {
      if (accuracy < 60 || confidence <= 2) {
        interval = Math.max(1, Math.floor(baseInterval / 2));
      } else if (accuracy >= 85 && confidence >= 4) {
        interval = baseInterval * 2;
      }
    }

    const nextRevision = addDays(new Date(), interval).toISOString();
    await this.upsert(userId, chapterId, {
      next_revision_at: nextRevision,
      last_revised_at: new Date().toISOString(),
    } as any);
  },

  // ── Queries for dashboard/revision centre ───────────────

  async getOverdue(userId: string): Promise<SscChapterProgress[]> {
    const today = startOfToday().toISOString();
    const { data, error } = await supabase
      .from('ssc_chapter_progress')
      .select('*')
      .eq('user_id', userId)
      .not('next_revision_at', 'is', null)
      .lt('next_revision_at', today);
    if (error) throw error;
    return data ?? [];
  },

  async getDueToday(userId: string): Promise<SscChapterProgress[]> {
    const today = startOfToday();
    const tomorrow = addDays(today, 1);
    const { data, error } = await supabase
      .from('ssc_chapter_progress')
      .select('*')
      .eq('user_id', userId)
      .not('next_revision_at', 'is', null)
      .gte('next_revision_at', today.toISOString())
      .lt('next_revision_at', tomorrow.toISOString());
    if (error) throw error;
    return data ?? [];
  },

  async getDueThisWeek(userId: string): Promise<SscChapterProgress[]> {
    const today = startOfToday();
    const nextWeek = addDays(today, 7);
    const { data, error } = await supabase
      .from('ssc_chapter_progress')
      .select('*')
      .eq('user_id', userId)
      .not('next_revision_at', 'is', null)
      .gte('next_revision_at', today.toISOString())
      .lt('next_revision_at', nextWeek.toISOString());
    if (error) throw error;
    return data ?? [];
  },

  async getWeak(userId: string): Promise<SscChapterProgress[]> {
    const { data, error } = await supabase
      .from('ssc_chapter_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('is_weak', true);
    if (error) throw error;
    return data ?? [];
  },

  // ── Helper: compute accuracy safely ────────────────────

  calcAccuracy(attempted: number, correct: number): number {
    if (attempted === 0) return 0;
    return Math.round((correct / attempted) * 100);
  },

  // ── Helper: is revision overdue? ────────────────────────

  isOverdue(progress: SscChapterProgress | null): boolean {
    if (!progress?.next_revision_at) return false;
    return isBefore(parseISO(progress.next_revision_at), new Date());
  },

  daysUntilRevision(progress: SscChapterProgress | null): number | null {
    if (!progress?.next_revision_at) return null;
    const diff =
      parseISO(progress.next_revision_at).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  },
};
