import { supabase } from '../lib/supabase';
import { logActivity } from './activity.service';

export const notesService = {
  async getByTopic(topicId) {
    const { data, error } = await supabase
      .from('topic_notes')
      .select('*')
      .eq('topic_id', topicId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsert(topicId, content, userId, topicName) {
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

  async delete(topicId, userId, topicName) {
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
