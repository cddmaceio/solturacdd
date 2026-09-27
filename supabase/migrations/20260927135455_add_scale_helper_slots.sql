alter table public.escalas
  add column if not exists ajudante2_codigo text default '',
  add column if not exists ajudante2_nome text default '',
  add column if not exists ajudante2_manual boolean not null default false,
  add column if not exists chapa_codigo text default '',
  add column if not exists chapa_nome text default '',
  add column if not exists chapa_manual boolean not null default false;

create index if not exists escalas_ajudante2_idx
  on public.escalas (ajudante2_codigo);
