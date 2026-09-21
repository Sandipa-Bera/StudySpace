import { supabase } from '../lib/supabase';
import type { ActivityLog } from '../types';

export async function logActivity(
  userId: string,
  actionType: string,
  entityType: string,
  entityId: string | null = null,
  metadata: Record<string, unknown> | null = null
): Promise<ActivityLog | null> {
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
    return data as ActivityLog;
  } catch (err) {
    console.warn('Could not log activity:', err);
    return null;
  }
}

export async function getUserActivity(userId: string, limit = 50): Promise<ActivityLog[]> {
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
    return (data || []) as ActivityLog[];
  } catch {
    return [];
  }
}

export async function getActivityByEntity(
  userId: string,
  entityType: string,
  entityId: string,
  limit = 20
): Promise<ActivityLog[]> {
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
    return (data || []) as ActivityLog[];
  } catch {
    return [];
  }
}

