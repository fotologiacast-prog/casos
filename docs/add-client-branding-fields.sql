-- Campos de identidade visual para clientes do Portal de Casos.
-- Rode no SQL Editor do Supabase antes de salvar Logo/Cores no /admin.

alter table public.clients add column if not exists logo_url text;
alter table public.clients add column if not exists brand_primary_color text;
alter table public.clients add column if not exists brand_accent_color text;

create or replace function public.get_client_by_case_token(p_token text)
returns table (
  id bigint,
  name text,
  "boardId" text,
  logo_url text,
  brand_primary_color text,
  brand_accent_color text,
  case_public_token text,
  case_board_id text,
  case_client_label text,
  drive_folder_id text,
  monday_board_id text,
  monday_client_label text,
  active boolean
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    c."boardId",
    c.logo_url,
    c.brand_primary_color,
    c.brand_accent_color,
    c.case_public_token,
    c.case_board_id,
    c.case_client_label,
    c.drive_folder_id,
    c.monday_board_id,
    c.monday_client_label,
    c.active
  from public.clients c
  where c.case_public_token = p_token
    and c.active = true
  limit 1;
$$;

revoke all on function public.get_client_by_case_token(text) from public;
grant execute on function public.get_client_by_case_token(text) to anon, authenticated;
