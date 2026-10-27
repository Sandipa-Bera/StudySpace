import { supabase } from '../../lib/supabase';
import type { SscPracticeSession, PracticeSessionForm } from '../../types/ssc.types';

export const sscPracticeService = {
  async getByChapter(
    userId: string,
    chapterId: string
  ): Promise<SscPracticeSession[]> {
    const { data, error } = await supabase
      .from('ssc_practice_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('chapter_id', chapterId)
      .order('session_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getRecent(userId: string, limit = 20): Promise<SscPracticeSession[]> {
    const { data, error } = await supabase
      .from('ssc_practice_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('session_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async getAll(userId: string): Promise<SscPracticeSession[]> {
    const { data, error } = await supabase
      .from('ssc_practice_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('session_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(
    userId: string,
    form: PracticeSessionForm
  ): Promise<SscPracticeSession> {
    if (form.attempted < 0 || form.correct < 0 || form.incorrect < 0 || form.skipped < 0) {
      throw new Error('Question counts cannot be negative.');
    }
    if (form.correct + form.incorrect + form.skipped > form.attempted) {
      throw new Error('Sum of correct + incorrect + skipped cannot exceed attempted.');
    }

    const { data, error } = await supabase
      .from('ssc_practice_sessions')
      .insert({
        user_id: userId,
        chapter_id: form.chapter_id,
        subject_id: form.subject_id,
        session_date: form.session_date,
        attempted: form.attempted,
        correct: form.correct,
        incorrect: form.incorrect,
        skipped: form.skipped,
        duration_minutes: form.duration_minutes,
        practice_source: form.practice_source || null,
        notes: form.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('ssc_practice_sessions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ── Aggregations ────────────────────────────────────────

  calcChapterAccuracy(sessions: SscPracticeSession[]): number {
    const totalAttempted = sessions.reduce((s, r) => s + r.attempted, 0);
    const totalCorrect = sessions.reduce((s, r) => s + r.correct, 0);
    if (totalAttempted === 0) return 0;
    return Math.round((totalCorrect / totalAttempted) * 100);
  },

  calcSubjectAccuracy(
    sessions: SscPracticeSession[],
    subjectId: string
  ): number {
    const subSessions = sessions.filter((s) => s.subject_id === subjectId);
    return this.calcChapterAccuracy(subSessions);
  },

  groupByDate(
    sessions: SscPracticeSession[]
  ): Record<string, { attempted: number; correct: number }> {
    const map: Record<string, { attempted: number; correct: number }> = {};
    for (const s of sessions) {
      if (!map[s.session_date]) map[s.session_date] = { attempted: 0, correct: 0 };
      map[s.session_date].attempted += s.attempted;
      map[s.session_date].correct += s.correct;
    }
    return map;
  },
};
