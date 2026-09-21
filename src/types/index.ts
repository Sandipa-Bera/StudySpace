// ─── Database entity types ─────────────────────────────────

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  scratchpad: string | null;
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  subject_id: string;
  name: string;
  description: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  chapter_id: string;
  name: string;
  description: string | null;
  is_completed: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface TopicNote {
  id: string;
  topic_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  title: string;
  content: string;
  mood: string | null;
  sticker: string | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

export interface ChapterAttachment {
  id: string;
  chapter_id: string;
  file_name: string;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface TopicAttachment {
  id: string;
  topic_id: string;
  file_name: string;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  topic_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Enriched types with computed fields ──────────────────

export interface SubjectWithProgress extends Subject {
  chapters_count: number;
  total_topics: number;
  completed_topics: number;
  progress: number;
}

export interface ChapterWithProgress extends Chapter {
  total_topics: number;
  completed_topics: number;
  progress: number;
  topics?: Topic[];
}

export interface TopicWithNote extends Topic {
  note?: TopicNote | null;
  attachments?: TopicAttachment[];
  study_sessions?: StudySession[];
}

// ─── Form types ────────────────────────────────────────────

export interface SubjectFormData {
  name: string;
  description: string;
}

export interface ChapterFormData {
  name: string;
  description: string;
}

export interface TopicFormData {
  name: string;
  description: string;
}

export interface JournalFormData {
  title: string;
  content: string;
  mood: string;
  sticker: string;
  entry_date: string;
}

// ─── Auth types ────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string | undefined;
}

// ─── Search types ───────────────────────────────────────────

export interface SearchResult {
  type: 'subject' | 'chapter' | 'topic' | 'note' | 'journal';
  id: string;
  title: string;
  context?: string;
  subject_name?: string;
  chapter_name?: string;
  topic_name?: string;
  relevance?: number;
}

// ─── Scratchpad types ───────────────────────────────────────

export interface Scratchpad {
  content: string;
  updated_at: string;
}
