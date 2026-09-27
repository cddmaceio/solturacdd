-- 0001: RBAC — papéis, permissões e perfis de usuário
-- Tabelas em pt-BR (sem acento), padrão snake_case.

create table public.papeis (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique check (chave in ('admin', 'supervisor', 'operador')),
  nome text not null,
  descricao text,
  criado_em timestamptz not null default now()
);

create table public.permissoes (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  nome text not null,
  dominio text not null check (
    dominio in ('escala', 'bases', 'pcd', 'ausencias', 'indicadores', 'exportacoes', 'usuarios')
  ),
  criado_em timestamptz not null default now()
);

create table public.papeis_permissoes (
  papel_id uuid not null references public.papeis (id) on delete cascade,
  permissao_id uuid not null references public.permissoes (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (papel_id, permissao_id)
);

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  papel_id uuid not null references public.papeis (id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null
);

create index perfis_papel_id_idx on public.perfis (papel_id);

-- ---------------------------------------------------------------------------
-- Funções auxiliares (security definer evita recursão de RLS nas policies)
-- ---------------------------------------------------------------------------

create or replace function public.possui_permissao(permissao text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.perfis p
    join public.papeis_permissoes pp on pp.papel_id = p.papel_id
    join public.permissoes pm on pm.id = pp.permissao_id
    where p.id = auth.uid()
      and p.ativo
      and pm.chave = permissao
  );
$$;

revoke all on function public.possui_permissao (text) from public;
grant execute on function public.possui_permissao (text) to authenticated;

create or replace function public.papel_atual ()
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select pa.chave
  from public.perfis p
  join public.papeis pa on pa.id = p.papel_id
  where p.id = auth.uid() and p.ativo;
$$;

revoke all on function public.papel_atual () from public;
grant execute on function public.papel_atual () to authenticated;

-- Trigger genérico de auditoria (reutilizada nas demais tabelas)
create or replace function public.atualizar_em ()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger perfis_atualizado_em
  before update on public.perfis
  for each row execute function public.atualizar_em ();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.papeis enable row level security;
alter table public.permissoes enable row level security;
alter table public.papeis_permissoes enable row level security;
alter table public.perfis enable row level security;

create policy "papeis: leitura autenticada"
  on public.papeis for select to authenticated using (true);

create policy "papeis: gestao com permissao"
  on public.papeis for all to authenticated
  using (public.possui_permissao ('usuarios.gerenciar'))
  with check (public.possui_permissao ('usuarios.gerenciar'));

create policy "permissoes: leitura autenticada"
  on public.permissoes for select to authenticated using (true);

create policy "permissoes: gestao com permissao"
  on public.permissoes for all to authenticated
  using (public.possui_permissao ('usuarios.gerenciar'))
  with check (public.possui_permissao ('usuarios.gerenciar'));

create policy "papeis_permissoes: leitura autenticada"
  on public.papeis_permissoes for select to authenticated using (true);

create policy "papeis_permissoes: gestao com permissao"
  on public.papeis_permissoes for all to authenticated
  using (public.possui_permissao ('usuarios.gerenciar'))
  with check (public.possui_permissao ('usuarios.gerenciar'));

create policy "perfis: leitura autenticada"
  on public.perfis for select to authenticated using (true);

create policy "perfis: gestao com permissao"
  on public.perfis for all to authenticated
  using (public.possui_permissao ('usuarios.gerenciar'))
  with check (public.possui_permissao ('usuarios.gerenciar'));

-- ---------------------------------------------------------------------------
-- Bootstrap do primeiro administrador (execute no SQL Editor, UMA vez):
--
-- 1) Crie o usuário em Authentication → Users (email + senha, "Auto Confirm User")
-- 2) Rode:
--
-- insert into public.perfis (id, nome, papel_id)
-- select u.id, 'Nome do Administrador', p.id
-- from auth.users u
-- cross join public.papeis p
-- where u.email = 'admin@exemplo.com' and p.chave = 'admin';
-- ---------------------------------------------------------------------------
