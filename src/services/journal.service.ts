import { supabase } from '../lib/supabase';
import type { JournalEntry, JournalFormData } from '../types';

export const journalService = {
  async getAll(userId: string): Promise<JournalEntry[]> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<JournalEntry | null> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(userId: string, form: JournalFormData): Promise<JournalEntry> {
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: userId,
        title: form.title,
        content: form.content,
        mood: form.mood || null,
        sticker: form.sticker || null,
        entry_date: form.entry_date,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, form: JournalFormData): Promise<JournalEntry> {
    const { data, error } = await supabase
      .from('journal_entries')
      .update({
        title: form.title,
        content: form.content,
        mood: form.mood || null,
        sticker: form.sticker || null,
        entry_date: form.entry_date,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('journal_entries').delete().eq('id', id);
    if (error) throw error;
  },
};
