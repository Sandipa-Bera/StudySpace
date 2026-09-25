-- ============================================================
-- StudySpace — Tasks Module Migration
-- Adds task management with recurrence support.
-- Safe to run multiple times on existing databases.
--
-- Prerequisites: The function public.update_updated_at_column()
-- must already exist (created by your main migration).
-- ============================================================

-- ─── TASKS ─────────────────────────────────────────────────
create table if not exists public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  title              text not null,
  description        text,
  due_date           date not null,
  due_time           time,
  priority           text not null default 'medium'
                       check (priority in ('low', 'medium', 'high')),
  completed          boolean not null default false,
  completed_at       timestamptz,

  -- Recurrence configuration (stored as a rule, not duplicated rows)
  recurrence_type    text not null default 'none'
                       check (recurrence_type in ('none', 'daily', 'weekly', 'monthly', 'custom')),
  recurrence_days    smallint[] not null default '{}',
  recurrence_end     date,
  recurrence_interval integer not null default 1
                       check (recurrence_interval >= 1),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ─── TASKS RLS ─────────────────────────────────────────────
alter table public.tasks enable row level security;

drop policy if exists "Users can CRUD their own tasks" on public.tasks;

drop policy if exists "Users can select their own tasks" on public.tasks;
create policy "Users can select their own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own tasks" on public.tasks;
create policy "Users can insert their own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tasks" on public.tasks;
create policy "Users can update their own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can delete their own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- ─── TASK COMPLETIONS ──────────────────────────────────────
-- Tracks per-date completions for recurring tasks.
-- Non-recurring tasks use the `completed` column on the tasks table.
create table if not exists public.task_completions (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks(id) on delete cascade,
  completion_date date not null,
  completed_at    timestamptz not null default now(),

  unique(task_id, completion_date)
);

-- ─── TASK COMPLETIONS RLS ──────────────────────────────────
alter table public.task_completions enable row level security;

drop policy if exists "Users can CRUD completions of their own tasks" on public.task_completions;

drop policy if exists "Users can select completions of their own tasks" on public.task_completions;
create policy "Users can select completions of their own tasks"
  on public.task_completions for select
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_completions.task_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert completions of their own tasks" on public.task_completions;
create policy "Users can insert completions of their own tasks"
  on public.task_completions for insert
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_completions.task_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update completions of their own tasks" on public.task_completions;
create policy "Users can update completions of their own tasks"
  on public.task_completions for update
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_completions.task_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete completions of their own tasks" on public.task_completions;
create policy "Users can delete completions of their own tasks"
  on public.task_completions for delete
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_completions.task_id
        and t.user_id = auth.uid()
    )
  );

-- ─── UPDATED_AT TRIGGER ────────────────────────────────────
-- Reuses the existing update_updated_at_column() function
-- from your main migration.
drop trigger if exists set_updated_at on public.tasks;
create trigger set_updated_at
  before update on public.tasks
  for each row
  execute procedure public.update_updated_at_column();

-- ─── INDEXES ───────────────────────────────────────────────
-- user_id: every query filters by user
create index if not exists idx_tasks_user_id
  on public.tasks(user_id);

-- user_id + due_date composite: the main query pattern
-- (get all tasks for user X, ordered by due_date)
create index if not exists idx_tasks_user_id_due_date
  on public.tasks(user_id, due_date);

-- user_id + completed: for filtering completed/incomplete
create index if not exists idx_tasks_user_id_completed
  on public.tasks(user_id, completed);

-- task_completions: task_id for joins and cascading
create index if not exists idx_task_completions_task_id
  on public.task_completions(task_id);

-- task_completions: completion_date for date-range queries
create index if not exists idx_task_completions_date
  on public.task_completions(completion_date);

-- task_completions: composite for the two-step query pattern
create index if not exists idx_task_completions_task_id_date
  on public.task_completions(task_id, completion_date);
