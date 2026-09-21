-- ============================================================
-- StudySpace — Idempotent Supabase Database Migration
-- Safe to run multiple times on new or existing databases.
-- ============================================================

-- ─── PROFILES ───────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text,
  display_name text,
  avatar_url   text,
  scratchpad   text,
  theme        text default 'warm-brown',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── SUBJECTS ───────────────────────────────────────────────
create table if not exists public.subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.subjects enable row level security;

drop policy if exists "Users can CRUD their own subjects" on public.subjects;
create policy "Users can CRUD their own subjects"
  on public.subjects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── CHAPTERS ───────────────────────────────────────────────
create table if not exists public.chapters (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  name        text not null,
  description text,
  order_index integer not null default 0,
  target_date date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.chapters add column if not exists target_date date;

alter table public.chapters enable row level security;

drop policy if exists "Users can CRUD chapters of their own subjects" on public.chapters;
create policy "Users can CRUD chapters of their own subjects"
  on public.chapters for all
  using (
    exists (
      select 1 from public.subjects s
      where s.id = chapters.subject_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.subjects s
      where s.id = chapters.subject_id
        and s.user_id = auth.uid()
    )
  );

-- ─── TOPICS ─────────────────────────────────────────────────
create table if not exists public.topics (
  id                  uuid primary key default gen_random_uuid(),
  chapter_id          uuid not null references public.chapters(id) on delete cascade,
  name                text not null,
  description         text,
  is_completed        boolean not null default false,
  understanding_status text check (understanding_status in ('understood', 'need_revision', 'dont_understand')),
  revision_status     text check (revision_status in ('none', 'needs_revision', 'revised')),
  is_favorite         boolean not null default false,
  target_date         date,
  order_index         integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.topics add column if not exists understanding_status text check (understanding_status in ('understood', 'need_revision', 'dont_understand'));
alter table public.topics add column if not exists revision_status text check (revision_status in ('none', 'needs_revision', 'revised'));
alter table public.topics add column if not exists is_favorite boolean not null default false;
alter table public.topics add column if not exists target_date date;

alter table public.topics enable row level security;

drop policy if exists "Users can CRUD topics of their own chapters" on public.topics;
create policy "Users can CRUD topics of their own chapters"
  on public.topics for all
  using (
    exists (
      select 1 from public.chapters c
      join public.subjects s on s.id = c.subject_id
      where c.id = topics.chapter_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chapters c
      join public.subjects s on s.id = c.subject_id
      where c.id = topics.chapter_id
        and s.user_id = auth.uid()
    )
  );

-- ─── TOPIC NOTES ────────────────────────────────────────────
create table if not exists public.topic_notes (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references public.topics(id) on delete cascade,
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.topic_notes enable row level security;

drop policy if exists "Users can CRUD notes of their own topics" on public.topic_notes;
create policy "Users can CRUD notes of their own topics"
  on public.topic_notes for all
  using (
    exists (
      select 1 from public.topics t
      join public.chapters c on c.id = t.chapter_id
      join public.subjects s on s.id = c.subject_id
      where t.id = topic_notes.topic_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.topics t
      join public.chapters c on c.id = t.chapter_id
      join public.subjects s on s.id = c.subject_id
      where t.id = topic_notes.topic_id
        and s.user_id = auth.uid()
    )
  );

-- ─── JOURNAL ENTRIES ────────────────────────────────────────
create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  content    text not null default '',
  mood       text,
  sticker    text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.journal_entries enable row level security;

drop policy if exists "Users can CRUD their own journal entries" on public.journal_entries;
create policy "Users can CRUD their own journal entries"
  on public.journal_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── CHAPTER ATTACHMENTS ───────────────────────────────────
create table if not exists public.chapter_attachments (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  file_name   text not null,
  storage_path text not null,
  file_type   text,
  file_size   bigint,
  created_at  timestamptz not null default now()
);

alter table public.chapter_attachments enable row level security;

drop policy if exists "Users can CRUD attachments of their own chapters" on public.chapter_attachments;
create policy "Users can CRUD attachments of their own chapters"
  on public.chapter_attachments for all
  using (
    exists (
      select 1 from public.chapters c
      join public.subjects s on s.id = c.subject_id
      where c.id = chapter_attachments.chapter_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chapters c
      join public.subjects s on s.id = c.subject_id
      where c.id = chapter_attachments.chapter_id
        and s.user_id = auth.uid()
    )
  );

-- ─── TOPIC ATTACHMENTS ─────────────────────────────────────
create table if not exists public.topic_attachments (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references public.topics(id) on delete cascade,
  file_name   text not null,
  storage_path text not null,
  file_type   text,
  file_size   bigint,
  created_at  timestamptz not null default now()
);

alter table public.topic_attachments enable row level security;

drop policy if exists "Users can CRUD attachments of their own topics" on public.topic_attachments;
create policy "Users can CRUD attachments of their own topics"
  on public.topic_attachments for all
  using (
    exists (
      select 1 from public.topics t
      join public.chapters c on c.id = t.chapter_id
      join public.subjects s on s.id = c.subject_id
      where t.id = topic_attachments.topic_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.topics t
      join public.chapters c on c.id = t.chapter_id
      join public.subjects s on s.id = c.subject_id
      where t.id = topic_attachments.topic_id
        and s.user_id = auth.uid()
    )
  );

-- ─── STUDY SESSIONS ─────────────────────────────────────────
create table if not exists public.study_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  topic_id        uuid not null references public.topics(id) on delete cascade,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  duration_seconds integer,
  created_at      timestamptz not null default now()
);

alter table public.study_sessions enable row level security;

drop policy if exists "Users can CRUD their own study sessions" on public.study_sessions;
create policy "Users can CRUD their own study sessions"
  on public.study_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── ACTIVITY LOG ───────────────────────────────────────────
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

alter table public.activity_log enable row level security;

drop policy if exists "Users can view their own activity log" on public.activity_log;
create policy "Users can view their own activity log"
  on public.activity_log for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own activity log" on public.activity_log;
create policy "Users can insert their own activity log"
  on public.activity_log for insert
  with check (auth.uid() = user_id);

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────────
create or replace function public.update_updated_at_column()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

drop trigger if exists set_updated_at on public.subjects;
create trigger set_updated_at before update on public.subjects
  for each row execute procedure public.update_updated_at_column();

drop trigger if exists set_updated_at on public.chapters;
create trigger set_updated_at before update on public.chapters
  for each row execute procedure public.update_updated_at_column();

drop trigger if exists set_updated_at on public.topics;
create trigger set_updated_at before update on public.topics
  for each row execute procedure public.update_updated_at_column();

drop trigger if exists set_updated_at on public.topic_notes;
create trigger set_updated_at before update on public.topic_notes
  for each row execute procedure public.update_updated_at_column();

drop trigger if exists set_updated_at on public.journal_entries;
create trigger set_updated_at before update on public.journal_entries
  for each row execute procedure public.update_updated_at_column();

-- ─── INDEXES ───────────────────────────────────────────────
create index if not exists idx_subjects_user_id on public.subjects(user_id);
create index if not exists idx_chapters_subject_id on public.chapters(subject_id);
create index if not exists idx_chapters_target_date on public.chapters(target_date);
create index if not exists idx_chapter_attachments_chapter_id on public.chapter_attachments(chapter_id);
create index if not exists idx_topics_chapter_id on public.topics(chapter_id);
create index if not exists idx_topic_notes_topic_id on public.topic_notes(topic_id);
create index if not exists idx_journal_entries_user_id on public.journal_entries(user_id);
create index if not exists idx_journal_entries_entry_date on public.journal_entries(entry_date);
create index if not exists idx_topic_attachments_topic_id on public.topic_attachments(topic_id);
create index if not exists idx_study_sessions_user_id on public.study_sessions(user_id);
create index if not exists idx_study_sessions_topic_id on public.study_sessions(topic_id);
create index if not exists idx_activity_log_user_id on public.activity_log(user_id);
create index if not exists idx_activity_log_created_at on public.activity_log(created_at);
create index if not exists idx_topics_target_date on public.topics(target_date);
create index if not exists idx_topics_is_favorite on public.topics(is_favorite);
create index if not exists idx_topics_revision_status on public.topics(revision_status);

-- ─── STORAGE BUCKET FOR ATTACHMENTS ─────────────────────────
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload attachments" on storage.objects;
create policy "Authenticated users can upload attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'attachments');

drop policy if exists "Authenticated users can select attachments" on storage.objects;
create policy "Authenticated users can select attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attachments');

drop policy if exists "Public read access for attachments" on storage.objects;
create policy "Public read access for attachments"
  on storage.objects for select
  to public
  using (bucket_id = 'attachments');

drop policy if exists "Authenticated users can delete attachments" on storage.objects;
create policy "Authenticated users can delete attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'attachments');

