import { supabase } from '../../lib/supabase';
import type { SscMockTest, SscMockTestSubjectResult, MockTestForm } from '../../types/ssc.types';

export const sscMockTestsService = {
  async getAll(userId: string): Promise<SscMockTest[]> {
    const { data, error } = await supabase
      .from('ssc_mock_tests')
      .select('*')
      .eq('user_id', userId)
      .order('test_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<SscMockTest | null> {
    const { data, error } = await supabase
      .from('ssc_mock_tests')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getSubjectResults(testId: string): Promise<SscMockTestSubjectResult[]> {
    const { data, error } = await supabase
      .from('ssc_mock_test_subject_results')
      .select('*')
      .eq('test_id', testId);
    if (error) throw error;
    return data ?? [];
  },

  async create(userId: string, form: MockTestForm): Promise<SscMockTest> {
    const accuracy =
      form.attempted && form.attempted > 0 && form.correct !== null
        ? Math.round((form.correct / form.attempted) * 100)
        : null;

    const { data, error } = await supabase
      .from('ssc_mock_tests')
      .insert({
        user_id: userId,
        test_name: form.test_name,
        test_date: form.test_date,
        tier: form.tier || null,
        total_questions: form.total_questions,
        attempted: form.attempted,
        correct: form.correct,
        incorrect: form.incorrect,
        score: form.score,
        max_score: form.max_score,
        duration_minutes: form.duration_minutes,
        notes: form.notes || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('ssc_mock_tests')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  calcAccuracy(attempted: number | null, correct: number | null): number {
    if (!attempted || attempted === 0 || correct === null) return 0;
    return Math.round((correct / attempted) * 100);
  },

  calcScorePct(score: number | null, maxScore: number | null): number {
    if (!score || !maxScore || maxScore === 0) return 0;
    return Math.round((score / maxScore) * 100);
  },
};
