// ─── SSC CGL Types ─────────────────────────────────────────

export type ChapterStatus = 'not_started' | 'in_progress' | 'completed' | 'revise';
export type TaskType = 'learn' | 'practice' | 'revise' | 'test' | 'custom';
export type PriorityLevel = 'high' | 'medium' | 'low';

// ─── Syllabus entities (shared/public) ─────────────────────

export interface SscSubject {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  description: string | null;
  created_at: string;
}

export interface SscChapter {
  id: string;
  subject_id: string;
  name: string;
  display_order: number;
  question_bank_count: number;
  source_reference: string | null;
  created_at: string;
  updated_at: string;
}

// ─── User-progress entities ────────────────────────────────

export interface SscChapterProgress {
  id: string;
  user_id: string;
  chapter_id: string;
  status: ChapterStatus;
  learning_done: boolean;
  notes_prepared: boolean;
  practice_done: boolean;
  confidence_rating: number | null;
  personal_notes: string | null;
  questions_attempted: number;
  questions_correct: number;
  time_spent_minutes: number;
  last_studied_at: string | null;
  last_revised_at: string | null;
  next_revision_at: string | null;
  priority_override: PriorityLevel | null;
  is_weak: boolean;
  created_at: string;
  updated_at: string;
}

export interface SscPracticeSession {
  id: string;
  user_id: string;
  chapter_id: string;
  subject_id: string;
  session_date: string;
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  duration_minutes: number | null;
  practice_source: string | null;
  notes: string | null;
  created_at: string;
}

export interface SscRevisionSession {
  id: string;
  user_id: string;
  chapter_id: string;
  revision_date: string;
  attempted: number | null;
  correct: number | null;
  confidence_rating: number | null;
  notes: string | null;
  next_revision_at: string | null;
  created_at: string;
}

export interface SscStudyTask {
  id: string;
  user_id: string;
  chapter_id: string | null;
  task_type: TaskType;
  title: string;
  planned_date: string;
  estimated_minutes: number | null;
  is_completed: boolean;
  completed_at: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SscMockTest {
  id: string;
  user_id: string;
  test_name: string;
  test_date: string;
  tier: string | null;
  total_questions: number | null;
  attempted: number | null;
  correct: number | null;
  incorrect: number | null;
  score: number | null;
  max_score: number | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SscMockTestSubjectResult {
  id: string;
  test_id: string;
  subject_id: string;
  attempted: number | null;
  correct: number | null;
  incorrect: number | null;
  score: number | null;
  created_at: string;
}

export interface SscUserSettings {
  user_id: string;
  daily_study_minutes: number;
  revision_intervals: number[];
  priority_weights: {
    exam_relevance: number;
    weakness: number;
    revision_urgency: number;
    dependency: number;
  };
  updated_at: string;
}

// ─── Enriched / computed types ─────────────────────────────

export interface SscChapterWithProgress extends SscChapter {
  subject?: SscSubject;
  progress: SscChapterProgress | null;
  accuracy: number; // 0-100
  revision_number: number; // how many revisions done
  priority_score: number; // 0-100
  days_until_revision: number | null; // null = no revision scheduled
  is_overdue: boolean;
}

export interface SscSubjectStats {
  subject: SscSubject;
  total_chapters: number;
  not_started: number;
  in_progress: number;
  completed: number;
  revise: number;
  weak: number;
  overdue: number;
  completion_pct: number;
  accuracy: number;
  questions_attempted: number;
}

export interface DashboardStats {
  total_subjects: number;
  total_chapters: number;
  not_started: number;
  in_progress: number;
  completed: number;
  revise: number;
  weak: number;
  overdue: number;
  total_attempted: number;
  overall_accuracy: number;
  subject_stats: SscSubjectStats[];
}

// ─── Form types ─────────────────────────────────────────────

export interface PracticeSessionForm {
  chapter_id: string;
  subject_id: string;
  session_date: string;
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  duration_minutes: number | null;
  practice_source: string;
  notes: string;
}

export interface RevisionSessionForm {
  chapter_id: string;
  revision_date: string;
  attempted: number | null;
  correct: number | null;
  confidence_rating: number | null;
  notes: string;
  next_revision_at: string | null;
}

export interface MockTestForm {
  test_name: string;
  test_date: string;
  tier: string;
  total_questions: number | null;
  attempted: number | null;
  correct: number | null;
  incorrect: number | null;
  score: number | null;
  max_score: number | null;
  duration_minutes: number | null;
  notes: string;
}

export interface StudyTaskForm {
  chapter_id: string | null;
  task_type: TaskType;
  title: string;
  planned_date: string;
  estimated_minutes: number | null;
  reason: string;
}

export interface ChapterProgressForm {
  status: ChapterStatus;
  learning_done: boolean;
  notes_prepared: boolean;
  practice_done: boolean;
  confidence_rating: number | null;
  personal_notes: string;
  priority_override: PriorityLevel | null;
}
