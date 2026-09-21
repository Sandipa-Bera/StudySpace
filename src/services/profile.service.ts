import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

export const profileService = {
  async getById(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as Profile;
  },

  async update(userId: string, updates: Partial<Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'scratchpad' | 'theme'>>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  },

  async updateTheme(userId: string, theme: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ theme })
      .eq('id', userId);

    if (error) throw error;
  },

  async updateScratchpad(userId: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ scratchpad: content })
      .eq('id', userId);

    if (error) throw error;
  },

  async getScratchpad(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('profiles')
      .select('scratchpad')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return '';
      throw error;
    }

    return (data as Profile)?.scratchpad || '';
  },
};
