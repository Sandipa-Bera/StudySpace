import { supabase } from '../lib/supabase';
import { logActivity } from './activity.service';
import type { Subject, SubjectFormData, SubjectWithProgress } from '../types';

export const subjectsService = {
  async getAll(userId: string): Promise<Subject[]> {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getAllWithProgress(userId: string): Promise<SubjectWithProgress[]> {
    const { data, error } = await supabase
      .from('subjects')
      .select(`
        *,
        chapters (
          id,
          topics (
            id,
            is_completed
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(subject => {
      const chapters = (subject as any).chapters || [];
      const allTopics = chapters.flatMap((chapter: any) => chapter.topics || []);
      const completedTopics = allTopics.filter((topic: any) => topic.is_completed).length;
      const totalTopics = allTopics.length;
      const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      return {
        ...subject,
        chapters_count: chapters.length,
        total_topics: totalTopics,
        completed_topics: completedTopics,
        progress,
      };
    });
  },

  async getById(id: string): Promise<Subject | null> {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByIdWithProgress(id: string): Promise<SubjectWithProgress | null> {
    const { data, error } = await supabase
      .from('subjects')
      .select(`
        *,
        chapters (
          id,
          topics (
            id,
            is_completed
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    const chapters = (data as any).chapters || [];
    const allTopics = chapters.flatMap((chapter: any) => chapter.topics || []);
    const completedTopics = allTopics.filter((topic: any) => topic.is_completed).length;
    const totalTopics = allTopics.length;
    const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    return {
      ...data,
      chapters_count: chapters.length,
      total_topics: totalTopics,
      completed_topics: completedTopics,
      progress,
    };
  },

  async create(userId: string, form: SubjectFormData): Promise<Subject> {
    const payload = { user_id: userId, name: form.name, description: form.description || null };
    console.log("AUTH USER ID:", userId);
    console.log("SUBJECT INSERT PAYLOAD:", payload);

    const { data, error } = await supabase
      .from('subjects')
      .insert(payload)
      .select()
      .single();

    console.log("SUBJECT INSERT RESULT:", { data, error });

    if (error) {
      console.error("SUBJECT ERROR CODE:", error.code);
      console.error("SUBJECT ERROR MESSAGE:", error.message);
      console.error("SUBJECT ERROR DETAILS:", error.details);
      console.error("SUBJECT ERROR HINT:", error.hint);
      throw error;
    }

    await logActivity(userId, 'subject_created', 'subject', data.id, { name: data.name });

    return data;
  },

  async update(id: string, form: SubjectFormData): Promise<Subject> {
    const { data, error } = await supabase
      .from('subjects')
      .update({ name: form.name, description: form.description || null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) throw error;
  },
};
