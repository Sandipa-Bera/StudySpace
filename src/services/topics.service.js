import { supabase } from '../lib/supabase';
import { logActivity } from './activity.service';

export const topicsService = {
  async getByChapter(chapterId) {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getByChapterWithNotes(chapterId) {
    const { data, error } = await supabase
      .from('topics')
      .select(`
        *,
        topic_notes (*)
      `)
      .eq('chapter_id', chapterId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    return (data || []).map(topic => ({
      ...topic,
      note: topic.topic_notes?.[0] || null,
    }));
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByIdWithDetails(id) {
    const { data, error } = await supabase
      .from('topics')
      .select(`
        *,
        topic_notes (*),
        topic_attachments (*),
        study_sessions (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      note: data.topic_notes?.[0] || null,
      attachments: data.topic_attachments || [],
      study_sessions: data.study_sessions || [],
    };
  },

  async create(chapterId, form, orderIndex) {
    // Only send fields that exist in the actual database schema
    const payload = {
      chapter_id: chapterId,
      name: form.name,
      description: form.description || null,
      is_completed: false,
      order_index: orderIndex,
    };
    console.log("TOPIC CHAPTER ID:", chapterId);
    console.log("TOPIC INSERT PAYLOAD:", payload);

    const { data, error } = await supabase
      .from('topics')
      .insert(payload)
      .select()
      .single();

    console.log("TOPIC INSERT RESULT:", { data, error });

    if (error) {
      console.error("TOPIC ERROR CODE:", error.code);
      console.error("TOPIC ERROR MESSAGE:", error.message);
      console.error("TOPIC ERROR DETAILS:", error.details);
      console.error("TOPIC ERROR HINT:", error.hint);
      throw error;
    }

    return data;
  },

  async update(id, form) {
    const updateData = {};
    if (form.name !== undefined) updateData.name = form.name;
    if (form.description !== undefined) updateData.description = form.description || null;

    const { data, error } = await supabase
      .from('topics')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async toggleCompletion(id, isCompleted, userId) {
    const { data, error } = await supabase
      .from('topics')
      .update({ is_completed: isCompleted })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    if (userId) {
      await logActivity(userId, isCompleted ? 'topic_completed' : 'topic_incomplete', 'topic', id, { name: data.name });
    }

    return data;
  },

  async updateUnderstandingStatus(id, status, userId) {
    const { data, error } = await supabase
      .from('topics')
      .update({ understanding_status: status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    if (userId && status && status !== 'none') {
      await logActivity(userId, `topic_marked_${status}`, 'topic', id, { name: data.name });
    }

    return data;
  },

  async updateRevisionStatus(id, _status, _userId) {
    // revision_status field doesn't exist in database yet, skip this
    return topicsService.getById(id);
  },

  async updateTargetDate(id, _targetDate, _userId) {
    // target_date field doesn't exist in database yet, skip this
    return topicsService.getById(id);
  },



  async getTopicsNeedingRevision() {
    // revision_status field doesn't exist in database yet, return empty array
    return [];
  },

  async getTopicsDueSoon(_days = 7) {
    // target_date field doesn't exist in database yet, return empty array
    return [];
  },

  async delete(id) {
    const { error } = await supabase.from('topics').delete().eq('id', id);
    if (error) throw error;
  },
};
