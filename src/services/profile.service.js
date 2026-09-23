import { supabase } from '../lib/supabase';

export const profileService = {
  async getById(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  },

  async update(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTheme(userId, theme) {
    const { error } = await supabase
      .from('profiles')
      .update({ theme })
      .eq('id', userId);

    if (error) throw error;
  },

  async updateScratchpad(userId, content) {
    const { error } = await supabase
      .from('profiles')
      .update({ scratchpad: content })
      .eq('id', userId);

    if (error) throw error;
  },

  async getScratchpad(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('scratchpad')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return '';
      throw error;
    }

    return data?.scratchpad || '';
  },
};
