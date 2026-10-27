import { supabase } from '../../lib/supabase';
import type { SscSubject } from '../../types/ssc.types';

export const sscSubjectsService = {
  async getAll(): Promise<SscSubject[]> {
    const { data, error } = await supabase
      .from('ssc_subjects')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<SscSubject | null> {
    const { data, error } = await supabase
      .from('ssc_subjects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getBySlug(slug: string): Promise<SscSubject | null> {
    const { data, error } = await supabase
      .from('ssc_subjects')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) throw error;
    return data;
  },
};
