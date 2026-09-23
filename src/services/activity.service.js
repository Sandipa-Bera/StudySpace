import { supabase } from '../lib/supabase';

export async function logActivity(
  userId,
  actionType,
  entityType,
  entityId = null,
  metadata = null
) {
  try {
    const { data, error } = await supabase
      .from('activity_log')
      .insert({
        user_id: userId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.warn('Could not log activity:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Could not log activity:', err);
    return null;
  }
}

export async function getUserActivity(userId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('Failed to load activity log:', error);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

export async function getActivityByEntity(
  userId,
  entityType,
  entityId,
  limit = 20
) {
  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', userId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}
