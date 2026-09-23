import { supabase } from '../lib/supabase';

export const chaptersService = {
  async getBySubject(subjectId) {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('subject_id', subjectId)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getBySubjectWithProgress(subjectId) {
    const { data, error } = await supabase
      .from('chapters')
      .select(`
        *,
        topics (
          id,
          is_completed
        )
      `)
      .eq('subject_id', subjectId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    return (data || []).map(chapter => {
      const topics = chapter.topics || [];
      const completedTopics = topics.filter((topic) => topic.is_completed).length;
      const totalTopics = topics.length;
      const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      return {
        ...chapter,
        total_topics: totalTopics,
        completed_topics: completedTopics,
        progress,
        topics: topics,
      };
    });
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByIdWithProgress(id) {
    const { data, error } = await supabase
      .from('chapters')
      .select(`
        *,
        topics (
          id,
          is_completed
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    const topics = data.topics || [];
    const completedTopics = topics.filter((topic) => topic.is_completed).length;
    const totalTopics = topics.length;
    const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    return {
      ...data,
      total_topics: totalTopics,
      completed_topics: completedTopics,
      progress,
      topics: topics,
    };
  },

  async create(subjectId, form, orderIndex) {
    const payload = {
      subject_id: subjectId,
      name: form.name,
      description: form.description || null,
      order_index: orderIndex,
    };
    console.log("CHAPTER INSERT PAYLOAD:", payload);

    const { data, error } = await supabase
      .from('chapters')
      .insert(payload)
      .select()
      .single();

    console.log("CHAPTER INSERT RESULT:", { data, error });

    if (error) {
      console.error("CHAPTER ERROR CODE:", error.code);
      console.error("CHAPTER ERROR MESSAGE:", error.message);
      console.error("CHAPTER ERROR DETAILS:", error.details);
      console.error("CHAPTER ERROR HINT:", error.hint);
      throw error;
    }

    return data;
  },

  async update(id, form) {
    const updateData = {};
    if (form.name !== undefined) updateData.name = form.name;
    if (form.description !== undefined) updateData.description = form.description || null;

    const { data, error } = await supabase
      .from('chapters')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateOrder(id, orderIndex) {
    const { data, error } = await supabase
      .from('chapters')
      .update({ order_index: orderIndex })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from('chapters').delete().eq('id', id);
    if (error) throw error;
  },
};
