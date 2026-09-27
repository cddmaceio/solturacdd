-- 0005: escalas (alocação por data) e ausências

create table public.escalas (
  id uuid primary key default gen_random_uuid(),
  data_operacao date not null,
  veiculo_placa text not null,
  motorista_codigo text default '',
  motorista_nome text default '',
  ajudante_codigo text default '',
  ajudante_nome text default '',
  sala text default '',
  observacao text default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  unique (data_operacao, veiculo_placa)
);

create index escalas_data_idx on public.escalas (data_operacao);
create index escalas_motorista_idx on public.escalas (motorista_codigo);
create index escalas_ajudante_idx on public.escalas (ajudante_codigo);

create trigger escalas_atualizado_em
  before update on public.escalas
  for each row execute function public.atualizar_em ();

create type public.tipo_ausencia as enum (
  'Folga', 'Falta', 'Férias', 'Atestado', 'INSS', 'Banco de horas', 'Treinamento', 'Outros'
);

create table public.ausencias (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  papel text not null check (papel in ('motorista', 'ajudante')),
  codigo text not null,
  nome text not null default '',
  -- vínculo vivo com o colaborador; snapshot de codigo/nome preserva o
  -- histórico mesmo que o cadastro seja excluído depois
  colaborador_id uuid references public.colaboradores (id) on delete set null,
  tipo public.tipo_ausencia not null,
  justificativa text default '',
  status_base text default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  unique (data, papel, codigo)
);

create index ausencias_data_idx on public.ausencias (data);
create index ausencias_colaborador_idx on public.ausencias (colaborador_id);

create trigger ausencias_atualizado_em
  before update on public.ausencias
  for each row execute function public.atualizar_em ();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.escalas enable row level security;
alter table public.ausencias enable row level security;

create policy "escalas: leitura autenticada"
  on public.escalas for select to authenticated using (true);

create policy "escalas: escrita com permissao"
  on public.escalas for all to authenticated
  using (public.possui_permissao ('escala.editar'))
  with check (public.possui_permissao ('escala.editar'));

create policy "ausencias: leitura autenticada"
  on public.ausencias for select to authenticated using (true);

create policy "ausencias: escrita com permissao"
  on public.ausencias for all to authenticated
  using (public.possui_permissao ('ausencias.registrar'))
  with check (public.possui_permissao ('ausencias.registrar'));
