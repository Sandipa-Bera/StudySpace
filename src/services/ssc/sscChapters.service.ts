import { supabase } from '../../lib/supabase';
import type { SscChapter } from '../../types/ssc.types';

export const sscChaptersService = {
  async getAll(): Promise<SscChapter[]> {
    const { data, error } = await supabase
      .from('ssc_chapters')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getBySubject(subjectId: string): Promise<SscChapter[]> {
    const { data, error } = await supabase
      .from('ssc_chapters')
      .select('*')
      .eq('subject_id', subjectId)
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<SscChapter | null> {
    const { data, error } = await supabase
      .from('ssc_chapters')
      .select('*, ssc_subjects(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
};
