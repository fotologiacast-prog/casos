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
alter table public.case_editing_requests add column if not exists creative_type text;
alter table public.case_editing_requests add column if not exists edited_material_count integer not null default 0;
alter table public.case_editing_requests add column if not exists monday_webhook_event_id uuid;
alter table public.case_editing_requests add column if not exists last_webhook_at timestamptz;

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

create table if not exists public.case_stage_usage_locks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_id bigint not null references public.clients(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  stage_id uuid not null references public.case_stages(id) on delete cascade,
  editing_request_id uuid references public.case_editing_requests(id) on delete set null,
  stage_name text not null,
  locked_by text,
  locked_at timestamptz not null default now(),
  note text,
  unique(case_id, stage_id)
);

alter table public.case_stage_usage_locks add column if not exists client_id bigint references public.clients(id) on delete cascade;
alter table public.case_stage_usage_locks add column if not exists case_id uuid references public.cases(id) on delete cascade;
alter table public.case_stage_usage_locks add column if not exists stage_id uuid references public.case_stages(id) on delete cascade;
alter table public.case_stage_usage_locks add column if not exists editing_request_id uuid references public.case_editing_requests(id) on delete set null;
alter table public.case_stage_usage_locks add column if not exists stage_name text;
alter table public.case_stage_usage_locks add column if not exists locked_by text;
alter table public.case_stage_usage_locks add column if not exists locked_at timestamptz not null default now();
alter table public.case_stage_usage_locks add column if not exists note text;

create index if not exists case_stage_usage_locks_client_id_idx on public.case_stage_usage_locks (client_id);
create index if not exists case_stage_usage_locks_case_id_idx on public.case_stage_usage_locks (case_id);
create index if not exists case_stage_usage_locks_stage_id_idx on public.case_stage_usage_locks (stage_id);
create index if not exists case_stage_usage_locks_editing_request_id_idx on public.case_stage_usage_locks (editing_request_id);

drop trigger if exists case_stage_usage_locks_set_updated_at on public.case_stage_usage_locks;
create trigger case_stage_usage_locks_set_updated_at
before update on public.case_stage_usage_locks
for each row
execute function public.set_updated_at();

alter table public.case_stage_usage_locks enable row level security;

drop policy if exists "No public direct access to case_stage_usage_locks" on public.case_stage_usage_locks;
create policy "No public direct access to case_stage_usage_locks"
  on public.case_stage_usage_locks
  for all
  using (false)
  with check (false);

create table if not exists public.monday_webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text,
  board_id text,
  item_id text,
  parent_item_id text,
  column_id text,
  column_title text,
  pulse_name text,
  status_text text,
  processed boolean not null default false,
  processing_error text,
  raw_payload jsonb not null default '{}'::jsonb
);

alter table public.monday_webhook_events add column if not exists event_type text;
alter table public.monday_webhook_events add column if not exists board_id text;
alter table public.monday_webhook_events add column if not exists item_id text;
alter table public.monday_webhook_events add column if not exists parent_item_id text;
alter table public.monday_webhook_events add column if not exists column_id text;
alter table public.monday_webhook_events add column if not exists column_title text;
alter table public.monday_webhook_events add column if not exists pulse_name text;
alter table public.monday_webhook_events add column if not exists status_text text;
alter table public.monday_webhook_events add column if not exists processed boolean not null default false;
alter table public.monday_webhook_events add column if not exists processing_error text;
alter table public.monday_webhook_events add column if not exists raw_payload jsonb not null default '{}'::jsonb;

create index if not exists monday_webhook_events_created_at_idx on public.monday_webhook_events (created_at desc);
create index if not exists monday_webhook_events_item_id_idx on public.monday_webhook_events (item_id);
create index if not exists monday_webhook_events_parent_item_id_idx on public.monday_webhook_events (parent_item_id);
create index if not exists monday_webhook_events_event_type_idx on public.monday_webhook_events (event_type);

alter table public.monday_webhook_events enable row level security;

drop policy if exists "No public direct access to monday_webhook_events" on public.monday_webhook_events;
create policy "No public direct access to monday_webhook_events"
  on public.monday_webhook_events
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

create table if not exists public.admin_notification_reads (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique(notification_id, client_id)
);

alter table public.admin_notification_reads add column if not exists notification_id uuid references public.admin_notifications(id) on delete cascade;
alter table public.admin_notification_reads add column if not exists client_id bigint references public.clients(id) on delete cascade;
alter table public.admin_notification_reads add column if not exists read_at timestamptz not null default now();

create unique index if not exists admin_notification_reads_notification_client_uidx
  on public.admin_notification_reads (notification_id, client_id);
create index if not exists admin_notification_reads_notification_id_idx
  on public.admin_notification_reads (notification_id);
create index if not exists admin_notification_reads_client_id_idx
  on public.admin_notification_reads (client_id);

alter table public.admin_notification_reads enable row level security;

drop policy if exists "No public direct access to admin_notification_reads" on public.admin_notification_reads;
create policy "No public direct access to admin_notification_reads"
  on public.admin_notification_reads
  for all
  using (false)
  with check (false);
