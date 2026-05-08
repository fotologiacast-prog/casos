-- Tabela para FAQs das etapas do portal
create table if not exists public.stage_faqs (
  id          uuid primary key default gen_random_uuid(),
  stage_type  text        not null,
  title       text        not null,
  content     text        not null default '',
  image_url   text,
  "order"     int         not null default 0,
  created_at  timestamptz not null default now()
);

-- Índice para buscas por etapa (usado na query com ?stage_type=...)
create index if not exists stage_faqs_stage_type_idx
  on public.stage_faqs (stage_type, "order");

-- RLS: leitura pública (a API faz queries com anon key)
alter table public.stage_faqs enable row level security;

create policy "Leitura pública de FAQs"
  on public.stage_faqs for select
  using (true);

-- Escrita só via service role (a API usa service role para mutações)
create policy "Escrita via service role"
  on public.stage_faqs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
