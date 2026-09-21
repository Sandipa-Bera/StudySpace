import { supabase } from '../lib/supabase';
import { logActivity } from './activity.service';
import type { TopicNote } from '../types';

export const notesService = {
  async getByTopic(topicId: string): Promise<TopicNote | null> {
    const { data, error } = await supabase
      .from('topic_notes')
      .select('*')
      .eq('topic_id', topicId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsert(topicId: string, content: string, userId?: string, topicName?: string): Promise<TopicNote> {
    // Try update first, then insert
    const existing = await notesService.getByTopic(topicId);
    if (existing) {
      const { data, error } = await supabase
        .from('topic_notes')
        .update({ content })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;

      if (userId) {
        await logActivity(userId, 'note_updated', 'note', existing.id, { name: topicName });
      }

      return data;
    } else {
      const { data, error } = await supabase
        .from('topic_notes')
        .insert({ topic_id: topicId, content })
        .select()
        .single();
      if (error) throw error;

      if (userId) {
        await logActivity(userId, 'note_created', 'note', data.id, { name: topicName });
      }

      return data;
    }
  },

  async delete(topicId: string, userId?: string, topicName?: string): Promise<void> {
    const existing = await notesService.getByTopic(topicId);
    const { error } = await supabase
      .from('topic_notes')
      .delete()
      .eq('topic_id', topicId);
    if (error) throw error;

    if (userId && existing) {
      await logActivity(userId, 'note_deleted', 'note', existing.id, { name: topicName });
    }
  },
};
