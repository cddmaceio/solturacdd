-- 0002: colaboradores (pessoas escaláveis) e equipes (duplas)

create type public.tipo_colaborador as enum ('motorista', 'ajudante');

create table public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nome text not null,
  tipo public.tipo_colaborador not null,
  sala text,
  status text not null default 'Disponivel',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  unique (codigo, tipo)
);

create index colaboradores_nome_idx on public.colaboradores (nome);
create index colaboradores_tipo_idx on public.colaboradores (tipo);

create trigger colaboradores_atualizado_em
  before update on public.colaboradores
  for each row execute function public.atualizar_em ();

-- Equipes: uma linha por "dupla" da Base Equipes.
-- A linha pode conter somente o motorista, somente o ajudante ou a dupla
-- completa. A unicidade de código é validada na aplicação (regra do legado,
-- que permite os códigos reservados 800/801 em várias linhas).
create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid references public.colaboradores (id) on delete cascade,
  ajudante_id uuid references public.colaboradores (id) on delete cascade,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  check (motorista_id is not null or ajudante_id is not null)
);

create index equipes_motorista_idx on public.equipes (motorista_id);
create index equipes_ajudante_idx on public.equipes (ajudante_id);

create trigger equipes_atualizado_em
  before update on public.equipes
  for each row execute function public.atualizar_em ();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.colaboradores enable row level security;
alter table public.equipes enable row level security;

create policy "colaboradores: leitura autenticada"
  on public.colaboradores for select to authenticated using (true);

create policy "colaboradores: escrita com permissao"
  on public.colaboradores for all to authenticated
  using (public.possui_permissao ('bases.editar'))
  with check (public.possui_permissao ('bases.editar'));

create policy "equipes: leitura autenticada"
  on public.equipes for select to authenticated using (true);

create policy "equipes: escrita com permissao"
  on public.equipes for all to authenticated
  using (public.possui_permissao ('bases.editar'))
  with check (public.possui_permissao ('bases.editar'));
