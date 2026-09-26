import { supabase } from '../lib/supabase';

export const journalService = {
  async getAll(userId) {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(userId, form) {
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: userId,
        title: form.title,
        content: form.content,
        mood: form.mood || null,
        sticker: form.sticker || null,
        photo_url: form.photo_url || null,
        entry_date: form.entry_date,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, form) {
    const { data, error } = await supabase
      .from('journal_entries')
      .update({
        title: form.title,
        content: form.content,
        mood: form.mood || null,
        sticker: form.sticker || null,
        photo_url: form.photo_url || null,
        entry_date: form.entry_date,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from('journal_entries').delete().eq('id', id);
    if (error) throw error;
  },
};
