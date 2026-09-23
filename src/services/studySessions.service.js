import { supabase } from '../lib/supabase';
import { logActivity } from './activity.service';

export async function startStudySession(userId, topicId, topicName) {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert({
      user_id: userId,
      topic_id: topicId,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  await logActivity(userId, 'study_session_started', 'study_session', data.id, { name: topicName });

  return data;
}

export async function endStudySession(sessionId, userId, topicName) {
  const { data: session } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session) throw new Error('Session not found');

  const endedAt = new Date().toISOString();
  const startedAt = new Date(session.started_at);
  const durationSeconds = Math.floor((new Date(endedAt).getTime() - startedAt.getTime()) / 1000);
  const duration = `${Math.floor(durationSeconds / 60)} minutes`;

  const { data, error } = await supabase
    .from('study_sessions')
    .update({
      ended_at: endedAt,
      duration_seconds: durationSeconds,
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;

  if (userId) {
    await logActivity(userId, 'study_session_ended', 'study_session', data.id, { name: topicName, duration });
  }

  return data;
}

export async function getTopicStudySessions(topicId) {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('topic_id', topicId)
    .order('started_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getUserStudySessions(userId, limit = 20) {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getActiveStudySession(userId) {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}
