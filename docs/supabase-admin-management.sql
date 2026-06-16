-- Admin management layer
-- Run this in Supabase SQL Editor before using the new /admin "Gerência por Clínica" status actions.

create table if not exists public.case_stage_admin_flags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_id bigint not null references public.clients(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  stage_id uuid not null references public.case_stages(id) on delete cascade,
  stage_name text not null,
  status text not null check (status in ('utilizado', 'fora_do_padrao', 'errado')),
  note text,
  updated_by text,
  unique(stage_id)
);

create index if not exists case_stage_admin_flags_client_id_idx
  on public.case_stage_admin_flags (client_id);

create index if not exists case_stage_admin_flags_case_id_idx
  on public.case_stage_admin_flags (case_id);

create index if not exists case_stage_admin_flags_stage_id_idx
  on public.case_stage_admin_flags (stage_id);

create index if not exists case_stage_admin_flags_status_idx
  on public.case_stage_admin_flags (status);

drop trigger if exists case_stage_admin_flags_set_updated_at on public.case_stage_admin_flags;
create trigger case_stage_admin_flags_set_updated_at
before update on public.case_stage_admin_flags
for each row
execute function public.set_updated_at();

alter table public.case_stage_admin_flags enable row level security;

drop policy if exists "No public direct access to case_stage_admin_flags" on public.case_stage_admin_flags;
create policy "No public direct access to case_stage_admin_flags"
  on public.case_stage_admin_flags
  for all
  using (false)
  with check (false);

create table if not exists public.case_admin_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id bigint references public.clients(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  stage_id uuid references public.case_stages(id) on delete set null,
  action text not null,
  previous_value jsonb,
  next_value jsonb,
  actor text
);

create index if not exists case_admin_history_client_id_idx
  on public.case_admin_history (client_id);

create index if not exists case_admin_history_case_id_idx
  on public.case_admin_history (case_id);

create index if not exists case_admin_history_stage_id_idx
  on public.case_admin_history (stage_id);

create index if not exists case_admin_history_created_at_idx
  on public.case_admin_history (created_at desc);

alter table public.case_admin_history enable row level security;

drop policy if exists "No public direct access to case_admin_history" on public.case_admin_history;
create policy "No public direct access to case_admin_history"
  on public.case_admin_history
  for all
  using (false)
  with check (false);
