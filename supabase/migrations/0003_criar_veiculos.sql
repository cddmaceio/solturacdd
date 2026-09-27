-- 0003: veículos (Base Fidelização)
-- Os códigos/nomes do motorista e ajudante fixos ficam desnormalizados de
-- propósito: a referência de fidelização existe mesmo para quem não está
-- cadastrado na Base Equipes.

create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  tipo_veiculo text not null default 'OUTRO',
  frota text,
  disponibilidade text default '',
  sala text,
  motorista_fixo_codigo text default '',
  motorista_fixo_nome text default '',
  ajudante_fixo_codigo text default '',
  ajudante_fixo_nome text default '',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null
);

create index veiculos_sala_idx on public.veiculos (sala);

create trigger veiculos_atualizado_em
  before update on public.veiculos
  for each row execute function public.atualizar_em ();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.veiculos enable row level security;

create policy "veiculos: leitura autenticada"
  on public.veiculos for select to authenticated using (true);

create policy "veiculos: escrita com permissao"
  on public.veiculos for all to authenticated
  using (public.possui_permissao ('bases.editar'))
  with check (public.possui_permissao ('bases.editar'));
