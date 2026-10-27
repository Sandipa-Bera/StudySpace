-- ═══════════════════════════════════════════════════════════════════════════
-- SSC CGL PREPARATION SYSTEM — Complete Database Migration
-- Run this once in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- The script is fully idempotent: safe to re-run without duplicating data.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. SUBJECTS ──────────────────────────────────────────────────────────────
create table if not exists public.ssc_subjects (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,
  description    text,
  display_order  int  not null default 0,
  color          text,
  created_at     timestamptz default now()
);

-- ── 2. CHAPTERS ──────────────────────────────────────────────────────────────
create table if not exists public.ssc_chapters (
  id                   uuid primary key default gen_random_uuid(),
  subject_id           uuid not null references public.ssc_subjects(id) on delete cascade,
  name                 text not null,
  display_order        int  not null default 0,
  question_bank_count  int  not null default 0,
  exam_tier            text,           -- 'Tier-1', 'Tier-2', 'Both'
  exam_section         text,           -- e.g. 'General Intelligence'
  created_at           timestamptz default now()
);

-- ── 3. CHAPTER PROGRESS (per user) ───────────────────────────────────────────
create table if not exists public.ssc_chapter_progress (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  chapter_id          uuid not null references public.ssc_chapters(id) on delete cascade,
  status              text not null default 'not_started'
                        check (status in ('not_started','in_progress','completed','revise')),
  learning_done       boolean not null default false,
  notes_prepared      boolean not null default false,
  practice_done       boolean not null default false,
  questions_attempted int     not null default 0,
  questions_correct   int     not null default 0,
  confidence_rating   int     check (confidence_rating between 1 and 5),
  is_weak             boolean not null default false,
  personal_notes      text,
  priority_override   text    check (priority_override in ('high','medium','low')),
  last_studied_at     timestamptz,
  last_revised_at     timestamptz,
  next_revision_at    timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (user_id, chapter_id)
);

-- ── 4. PRACTICE SESSIONS ──────────────────────────────────────────────────────
create table if not exists public.ssc_practice_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  chapter_id       uuid not null references public.ssc_chapters(id) on delete cascade,
  subject_id       uuid not null references public.ssc_subjects(id) on delete cascade,
  session_date     date not null,
  attempted        int  not null default 0,
  correct          int  not null default 0,
  incorrect        int  not null default 0,
  skipped          int  not null default 0,
  duration_minutes int,
  practice_source  text,
  notes            text,
  created_at       timestamptz default now()
);

-- ── 5. REVISION SESSIONS ──────────────────────────────────────────────────────
create table if not exists public.ssc_revision_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  chapter_id        uuid not null references public.ssc_chapters(id) on delete cascade,
  revision_date     date not null,
  attempted         int,
  correct           int,
  confidence_rating int check (confidence_rating between 1 and 5),
  notes             text,
  next_revision_at  timestamptz,
  created_at        timestamptz default now()
);

-- ── 6. STUDY TASKS ────────────────────────────────────────────────────────────
create table if not exists public.ssc_study_tasks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  chapter_id         uuid references public.ssc_chapters(id) on delete set null,
  task_type          text not null default 'learn'
                       check (task_type in ('learn','practice','revise','test','custom')),
  title              text not null,
  planned_date       date not null,
  estimated_minutes  int,
  reason             text,
  is_completed       boolean not null default false,
  completed_at       timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- ── 7. MOCK TESTS ─────────────────────────────────────────────────────────────
create table if not exists public.ssc_mock_tests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  test_name        text not null,
  test_date        date not null,
  tier             text,
  total_questions  int,
  attempted        int,
  correct          int,
  incorrect        int,
  score            numeric,
  max_score        numeric,
  duration_minutes int,
  notes            text,
  created_at       timestamptz default now()
);

-- ── 8. USER SETTINGS ─────────────────────────────────────────────────────────
create table if not exists public.ssc_user_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  daily_study_minutes  int  not null default 120,
  revision_intervals   jsonb not null default '[1,3,7,14,30]',
  priority_weights     jsonb not null default '{"exam_relevance":35,"weakness":30,"revision_urgency":20,"dependency":15}',
  updated_at           timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

-- Subjects & chapters are public (read) and admin-only (write)
alter table public.ssc_subjects  enable row level security;
alter table public.ssc_chapters  enable row level security;
alter table public.ssc_chapter_progress  enable row level security;
alter table public.ssc_practice_sessions enable row level security;
alter table public.ssc_revision_sessions enable row level security;
alter table public.ssc_study_tasks       enable row level security;
alter table public.ssc_mock_tests        enable row level security;
alter table public.ssc_user_settings     enable row level security;

-- Public subjects/chapters — anyone logged in can read
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'ssc_subjects' and policyname = 'ssc_subjects_read') then
    create policy ssc_subjects_read on public.ssc_subjects for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'ssc_chapters' and policyname = 'ssc_chapters_read') then
    create policy ssc_chapters_read on public.ssc_chapters for select using (true);
  end if;
end $$;

-- User-scoped tables — each user can only see/modify their own rows
do $$ begin
  -- ssc_chapter_progress
  if not exists (select 1 from pg_policies where tablename = 'ssc_chapter_progress' and policyname = 'ssc_progress_own') then
    create policy ssc_progress_own on public.ssc_chapter_progress
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  -- ssc_practice_sessions
  if not exists (select 1 from pg_policies where tablename = 'ssc_practice_sessions' and policyname = 'ssc_practice_own') then
    create policy ssc_practice_own on public.ssc_practice_sessions
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  -- ssc_revision_sessions
  if not exists (select 1 from pg_policies where tablename = 'ssc_revision_sessions' and policyname = 'ssc_revision_own') then
    create policy ssc_revision_own on public.ssc_revision_sessions
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  -- ssc_study_tasks
  if not exists (select 1 from pg_policies where tablename = 'ssc_study_tasks' and policyname = 'ssc_tasks_own') then
    create policy ssc_tasks_own on public.ssc_study_tasks
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  -- ssc_mock_tests
  if not exists (select 1 from pg_policies where tablename = 'ssc_mock_tests' and policyname = 'ssc_mocks_own') then
    create policy ssc_mocks_own on public.ssc_mock_tests
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  -- ssc_user_settings
  if not exists (select 1 from pg_policies where tablename = 'ssc_user_settings' and policyname = 'ssc_settings_own') then
    create policy ssc_settings_own on public.ssc_user_settings
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA — 4 Subjects + 66 Chapters, 4800 questions total
-- Uses INSERT … ON CONFLICT DO NOTHING for idempotency
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Insert subjects
insert into public.ssc_subjects (id, name, slug, description, display_order, color) values
  ('11111111-0000-0000-0000-000000000001', 'General Intelligence & Reasoning', 'reasoning',        'Verbal and non-verbal reasoning, logical reasoning, and analytical ability', 1, '#8B5CF6'),
  ('11111111-0000-0000-0000-000000000002', 'General Awareness',                'general-studies',  'History, Geography, Polity, Economy, Science, Current Affairs',             2, '#10B981'),
  ('11111111-0000-0000-0000-000000000003', 'Quantitative Aptitude',            'quantitative',     'Arithmetic, Algebra, Geometry, Mensuration, Trigonometry, Statistics',     3, '#3B82F6'),
  ('11111111-0000-0000-0000-000000000004', 'English Comprehension',            'english',          'Grammar, Vocabulary, Reading Comprehension, Error Spotting, Cloze Test',   4, '#F59E0B')
on conflict (slug) do nothing;

-- STEP 2: Insert chapters using subject slugs as lookup
-- NOTE: We reference subjects by their seeded UUIDs for portability

-- ── Reasoning: 16 chapters = 1200 questions ──────────────────────────────────
insert into public.ssc_chapters (subject_id, name, display_order, question_bank_count, exam_tier, exam_section) values
  ('11111111-0000-0000-0000-000000000001', 'Analogy',                              1,  85, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Classification (Odd One Out)',          2,  80, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Series — Number & Letter',             3,  90, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Coding & Decoding',                    4,  80, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Blood Relations',                      5,  70, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Direction & Distance',                 6,  65, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Ranking & Order',                      7,  65, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Venn Diagrams',                        8,  75, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Syllogism',                            9,  80, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Matrix',                              10,  65, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Statement & Conclusions',             11,  70, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Non-Verbal Reasoning (Figures)',      12,  90, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Mathematical Operations',             13,  65, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Seating Arrangement & Puzzles',       14,  60, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Clock & Calendar',                    15,  60, 'Both', 'General Intelligence'),
  ('11111111-0000-0000-0000-000000000001', 'Miscellaneous Reasoning',             16,  60, 'Both', 'General Intelligence')
on conflict do nothing;

-- ── General Awareness: 17 chapters = 1200 questions ──────────────────────────
insert into public.ssc_chapters (subject_id, name, display_order, question_bank_count, exam_tier, exam_section) values
  ('11111111-0000-0000-0000-000000000002', 'Ancient & Medieval History',           1,  80, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Modern Indian History',                2,  90, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'World History',                        3,  50, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Indian Geography',                     4,  85, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'World Geography',                      5,  60, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Indian Polity & Constitution',         6,  90, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Indian Economy & Budget',              7,  85, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Physics',                              8,  80, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Chemistry',                            9,  75, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Biology',                             10,  80, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Computer & Technology',               11,  55, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Awards, Sports & Books',              12,  65, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Current Affairs',                     13, 100, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Art, Culture & Heritage',             14,  55, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Static GK (Dams, Rivers, Passes)',    15,  65, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Environment & Ecology',               16,  55, 'Both', 'General Awareness'),
  ('11111111-0000-0000-0000-000000000002', 'Miscellaneous GK',                    17,  26, 'Both', 'General Awareness')
on conflict do nothing;

-- ── Quantitative Aptitude: 17 chapters = 1200 questions ──────────────────────
insert into public.ssc_chapters (subject_id, name, display_order, question_bank_count, exam_tier, exam_section) values
  ('11111111-0000-0000-0000-000000000003', 'Number System',                        1,  80, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Simplification & Approximation',       2,  75, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'HCF & LCM',                           3,  60, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Ratio, Proportion & Partnership',      4,  75, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Percentage',                           5,  75, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Average',                              6,  65, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Profit, Loss & Discount',              7,  80, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Simple & Compound Interest',           8,  70, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Time, Speed & Distance',               9,  80, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Time & Work',                         10,  75, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Algebra & Linear Equations',          11,  80, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Geometry & Lines/Angles',             12,  70, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Mensuration — 2D & 3D',               13,  80, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Trigonometry & Height and Distance',  14,  70, 'Both', 'Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Data Interpretation',                 15,  80, 'Tier-2','Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Statistics (Mean, Median, Mode)',     16,  65, 'Tier-2','Quantitative Aptitude'),
  ('11111111-0000-0000-0000-000000000003', 'Miscellaneous Quant',                 17,  40, 'Both', 'Quantitative Aptitude')
on conflict do nothing;

-- ── English Comprehension: 16 chapters = 1200 questions ──────────────────────
insert into public.ssc_chapters (subject_id, name, display_order, question_bank_count, exam_tier, exam_section) values
  ('11111111-0000-0000-0000-000000000004', 'Reading Comprehension',                1, 100, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Error Spotting',                       2,  95, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Fill in the Blanks',                   3,  80, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Cloze Test',                           4,  80, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Para Jumbles',                         5,  75, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Sentence Improvement',                 6,  80, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Synonyms & Antonyms',                  7,  90, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Idioms & Phrases',                     8,  80, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'One Word Substitution',                9,  80, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Active & Passive Voice',              10,  75, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Direct & Indirect Speech',            11,  75, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Spelling Correction',                 12,  65, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Parts of Speech (Grammar)',            13,  65, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Sentence Arrangement (PQRS)',         14,  70, 'Both', 'English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Comprehension Passage (Long)',        15,  60, 'Tier-2','English Comprehension'),
  ('11111111-0000-0000-0000-000000000004', 'Miscellaneous English',               16,  30, 'Both', 'English Comprehension')
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Run these to confirm correctness:
--
--   select name, count(*) as chapters, sum(question_bank_count) as total_qb
--   from ssc_subjects s join ssc_chapters c on s.id = c.subject_id
--   group by s.name order by s.display_order;
--
-- Expected output:
--   General Intelligence & Reasoning | 16 chapters | 1200 questions
--   General Awareness                | 17 chapters | 1200 questions  (note: ±1 rounding)
--   Quantitative Aptitude            | 17 chapters | 1200 questions  (note: ±1 rounding)
--   English Comprehension            | 16 chapters | 1200 questions
--   Total                            | 66 chapters | 4800 questions

-- ══ END OF MIGRATION ═══════════════════════════════════════════════════════
