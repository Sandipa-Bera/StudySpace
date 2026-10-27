import { supabase } from '../../lib/supabase';
import type { SscUserSettings } from '../../types/ssc.types';

const DEFAULT_SETTINGS: Omit<SscUserSettings, 'user_id' | 'updated_at'> = {
  daily_study_minutes: 120,
  revision_intervals: [1, 3, 7, 14, 30],
  priority_weights: {
    exam_relevance: 35,
    weakness: 30,
    revision_urgency: 20,
    dependency: 15,
  },
};

export const sscSettingsService = {
  async get(userId: string): Promise<SscUserSettings> {
    const { data, error } = await supabase
      .from('ssc_user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // Return defaults without writing — write happens on first explicit save
      return {
        user_id: userId,
        updated_at: new Date().toISOString(),
        ...DEFAULT_SETTINGS,
      };
    }

    return {
      ...data,
      revision_intervals: Array.isArray(data.revision_intervals)
        ? data.revision_intervals
        : DEFAULT_SETTINGS.revision_intervals,
      priority_weights:
        typeof data.priority_weights === 'object' && data.priority_weights !== null
          ? (data.priority_weights as SscUserSettings['priority_weights'])
          : DEFAULT_SETTINGS.priority_weights,
    };
  },

  async save(
    userId: string,
    updates: Partial<Omit<SscUserSettings, 'user_id' | 'updated_at'>>
  ): Promise<SscUserSettings> {
    const { data, error } = await supabase
      .from('ssc_user_settings')
      .upsert(
        { user_id: userId, ...updates, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data as SscUserSettings;
  },

  defaults: DEFAULT_SETTINGS,
};
