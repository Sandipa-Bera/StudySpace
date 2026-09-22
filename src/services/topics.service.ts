import { supabase } from '../lib/supabase';
import { logActivity } from './activity.service';
import type { Topic, TopicFormData, TopicWithNote } from '../types';

export const topicsService = {
  async getByChapter(chapterId: string): Promise<Topic[]> {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getByChapterWithNotes(chapterId: string): Promise<TopicWithNote[]> {
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
      note: (topic as any).topic_notes?.[0] || null,
    }));
  },

  async getById(id: string): Promise<Topic | null> {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByIdWithDetails(id: string): Promise<TopicWithNote | null> {
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
      note: (data as any).topic_notes?.[0] || null,
      attachments: (data as any).topic_attachments || [],
      study_sessions: (data as any).study_sessions || [],
    };
  },

  async create(chapterId: string, form: TopicFormData, orderIndex: number): Promise<Topic> {
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

  async update(id: string, form: Partial<TopicFormData>): Promise<Topic> {
    const updateData: Record<string, unknown> = {};
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

  async toggleCompletion(id: string, isCompleted: boolean, userId?: string): Promise<Topic> {
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

  async updateUnderstandingStatus(id: string, status: 'understood' | 'need_revision' | 'dont_understand' | 'none' | null, userId?: string): Promise<Topic> {
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

  async updateRevisionStatus(id: string, _status: 'none' | 'needs_revision' | 'revised' | null, _userId?: string): Promise<Topic> {
    // revision_status field doesn't exist in database yet, skip this
    return topicsService.getById(id) as Promise<Topic>;
  },

  async updateTargetDate(id: string, _targetDate: string | null, _userId?: string): Promise<Topic> {
    // target_date field doesn't exist in database yet, skip this
    return topicsService.getById(id) as Promise<Topic>;
  },



  async getTopicsNeedingRevision(): Promise<Topic[]> {
    // revision_status field doesn't exist in database yet, return empty array
    return [];
  },

  async getTopicsDueSoon(_days: number = 7): Promise<Topic[]> {
    // target_date field doesn't exist in database yet, return empty array
    return [];
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('topics').delete().eq('id', id);
    if (error) throw error;
  },
};
