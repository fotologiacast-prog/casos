-- Rode este arquivo no SQL Editor do Supabase para habilitar:
-- 1) rastreio de pedidos enviados para edicao
-- 2) dashboard do /admin
-- 3) notificacoes manuais do /admin para o portal dos clientes

create table if not exists public.case_editing_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_id bigint not null references public.clients(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  stage_id uuid references public.case_stages(id) on delete set null,
  monday_item_id text,
  monday_subitem_id text,
  stage_name text not null,
  material_url text,
  status text not null default 'sent',
  sent_at timestamptz not null default now(),
  edited_at timestamptz,
  unique(case_id, stage_id)
);

alter table public.case_editing_requests add column if not exists client_id bigint references public.clients(id) on delete cascade;
alter table public.case_editing_requests add column if not exists case_id uuid references public.cases(id) on delete cascade;
alter table public.case_editing_requests add column if not exists stage_id uuid references public.case_stages(id) on delete set null;
alter table public.case_editing_requests add column if not exists monday_item_id text;
alter table public.case_editing_requests add column if not exists monday_subitem_id text;
alter table public.case_editing_requests add column if not exists stage_name text;
alter table public.case_editing_requests add column if not exists material_url text;
alter table public.case_editing_requests add column if not exists status text not null default 'sent';
alter table public.case_editing_requests add column if not exists sent_at timestamptz not null default now();
alter table public.case_editing_requests add column if not exists edited_at timestamptz;

create index if not exists case_editing_requests_client_id_idx on public.case_editing_requests (client_id);
create index if not exists case_editing_requests_case_id_idx on public.case_editing_requests (case_id);
create index if not exists case_editing_requests_monday_subitem_id_idx on public.case_editing_requests (monday_subitem_id);
create index if not exists case_editing_requests_status_idx on public.case_editing_requests (status);

drop trigger if exists case_editing_requests_set_updated_at on public.case_editing_requests;
create trigger case_editing_requests_set_updated_at
before update on public.case_editing_requests
for each row
execute function public.set_updated_at();

alter table public.case_editing_requests enable row level security;

drop policy if exists "No public direct access to case_editing_requests" on public.case_editing_requests;
create policy "No public direct access to case_editing_requests"
  on public.case_editing_requests
  for all
  using (false)
  with check (false);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  body text,
  media_url text,
  cta_label text,
  cta_url text,
  audience text not null default 'all',
  client_id bigint references public.clients(id) on delete cascade,
  active boolean not null default true,
  published_at timestamptz not null default now()
);

alter table public.admin_notifications add column if not exists title text;
alter table public.admin_notifications add column if not exists body text;
alter table public.admin_notifications add column if not exists media_url text;
alter table public.admin_notifications add column if not exists cta_label text;
alter table public.admin_notifications add column if not exists cta_url text;
alter table public.admin_notifications add column if not exists audience text not null default 'all';
alter table public.admin_notifications add column if not exists client_id bigint references public.clients(id) on delete cascade;
alter table public.admin_notifications add column if not exists active boolean not null default true;
alter table public.admin_notifications add column if not exists published_at timestamptz not null default now();

create index if not exists admin_notifications_active_idx on public.admin_notifications (active);
create index if not exists admin_notifications_client_id_idx on public.admin_notifications (client_id);
create index if not exists admin_notifications_published_at_idx on public.admin_notifications (published_at desc);

drop trigger if exists admin_notifications_set_updated_at on public.admin_notifications;
create trigger admin_notifications_set_updated_at
before update on public.admin_notifications
for each row
execute function public.set_updated_at();

alter table public.admin_notifications enable row level security;

drop policy if exists "No public direct access to admin_notifications" on public.admin_notifications;
create policy "No public direct access to admin_notifications"
  on public.admin_notifications
  for all
  using (false)
  with check (false);
