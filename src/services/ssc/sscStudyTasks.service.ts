import { supabase } from '../../lib/supabase';
import type { SscStudyTask, StudyTaskForm } from '../../types/ssc.types';

export const sscStudyTasksService = {
  async getByDate(userId: string, date: string): Promise<SscStudyTask[]> {
    const { data, error } = await supabase
      .from('ssc_study_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('planned_date', date)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<SscStudyTask[]> {
    const { data, error } = await supabase
      .from('ssc_study_tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('planned_date', startDate)
      .lte('planned_date', endDate)
      .order('planned_date', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getToday(userId: string): Promise<SscStudyTask[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.getByDate(userId, today);
  },

  async create(userId: string, form: StudyTaskForm): Promise<SscStudyTask> {
    const { data, error } = await supabase
      .from('ssc_study_tasks')
      .insert({
        user_id: userId,
        chapter_id: form.chapter_id,
        task_type: form.task_type,
        title: form.title,
        planned_date: form.planned_date,
        estimated_minutes: form.estimated_minutes,
        reason: form.reason || null,
        is_completed: false,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async complete(id: string): Promise<SscStudyTask> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('ssc_study_tasks')
      .update({ is_completed: true, completed_at: now, updated_at: now })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async uncomplete(id: string): Promise<SscStudyTask> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('ssc_study_tasks')
      .update({ is_completed: false, completed_at: null, updated_at: now })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('ssc_study_tasks')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async reschedule(id: string, newDate: string): Promise<SscStudyTask> {
    const { data, error } = await supabase
      .from('ssc_study_tasks')
      .update({ planned_date: newDate, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<StudyTaskForm>): Promise<SscStudyTask> {
    const { data, error } = await supabase
      .from('ssc_study_tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
