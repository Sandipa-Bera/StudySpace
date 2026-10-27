import { supabase } from '../../lib/supabase';
import type { SscRevisionSession, RevisionSessionForm } from '../../types/ssc.types';

export const sscRevisionService = {
  async getByChapter(
    userId: string,
    chapterId: string
  ): Promise<SscRevisionSession[]> {
    const { data, error } = await supabase
      .from('ssc_revision_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('chapter_id', chapterId)
      .order('revision_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getAll(userId: string): Promise<SscRevisionSession[]> {
    const { data, error } = await supabase
      .from('ssc_revision_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('revision_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getRevisionCount(userId: string, chapterId: string): Promise<number> {
    const { count, error } = await supabase
      .from('ssc_revision_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('chapter_id', chapterId);
    if (error) throw error;
    return count ?? 0;
  },

  async create(
    userId: string,
    form: RevisionSessionForm
  ): Promise<SscRevisionSession> {
    const { data, error } = await supabase
      .from('ssc_revision_sessions')
      .insert({
        user_id: userId,
        chapter_id: form.chapter_id,
        revision_date: form.revision_date,
        attempted: form.attempted,
        correct: form.correct,
        confidence_rating: form.confidence_rating,
        notes: form.notes || null,
        next_revision_at: form.next_revision_at,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('ssc_revision_sessions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
