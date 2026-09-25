import { supabase } from '../lib/supabase';

export const tasksService = {
  // ─── CRUD ─────────────────────────────────────────────────

  async getAll(userId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(userId, form) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: form.title,
        description: form.description || null,
        due_date: form.due_date,
        due_time: form.due_time || null,
        priority: form.priority || 'medium',
        completed: false,
        recurrence_type: form.recurrence_type || 'none',
        recurrence_days: form.recurrence_days || [],
        recurrence_end: form.recurrence_end || null,
        recurrence_interval: form.recurrence_interval || 1,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, form) {
    const payload = {
      title: form.title,
      description: form.description || null,
      due_date: form.due_date,
      due_time: form.due_time || null,
      priority: form.priority || 'medium',
      recurrence_type: form.recurrence_type || 'none',
      recurrence_days: form.recurrence_days || [],
      recurrence_end: form.recurrence_end || null,
      recurrence_interval: form.recurrence_interval || 1,
    };
    if (form.completed !== undefined) {
      payload.completed = form.completed;
      payload.completed_at = form.completed ? new Date().toISOString() : null;
    }
    const { data, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },

  async toggleComplete(id, completed) {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ─── RECURRING TASK COMPLETIONS ───────────────────────────

  async getCompletions(taskId) {
    const { data, error } = await supabase
      .from('task_completions')
      .select('*')
      .eq('task_id', taskId)
      .order('completion_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getAllCompletions(userId) {
    // Get all task IDs for this user first, then fetch their completions
    const { data: userTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId);
    if (tasksError) throw tasksError;

    const taskIds = (userTasks ?? []).map(t => t.id);
    if (taskIds.length === 0) return [];

    const { data, error } = await supabase
      .from('task_completions')
      .select('*')
      .in('task_id', taskIds);
    if (error) throw error;
    return data ?? [];
  },

  async addCompletion(taskId, date) {
    const { data, error } = await supabase
      .from('task_completions')
      .upsert(
        { task_id: taskId, completion_date: date },
        { onConflict: 'task_id,completion_date' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeCompletion(taskId, date) {
    const { error } = await supabase
      .from('task_completions')
      .delete()
      .eq('task_id', taskId)
      .eq('completion_date', date);
    if (error) throw error;
  },

  // Delete all future occurrences' completions from a date
  async deleteFutureCompletions(taskId, fromDate) {
    const { error } = await supabase
      .from('task_completions')
      .delete()
      .eq('task_id', taskId)
      .gte('completion_date', fromDate);
    if (error) throw error;
  },
};
