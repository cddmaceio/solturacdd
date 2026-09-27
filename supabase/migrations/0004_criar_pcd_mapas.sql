-- 0004: PCD — linhas do arquivo diário de mapas
-- A importação substitui as linhas das datas presentes no arquivo.

create table public.pcd_mapas (
  id uuid primary key default gen_random_uuid(),
  data_entrega date not null,
  mapa text not null,
  roadshow text default '',
  as_rota text default '',
  armazem text default '',
  tipo_veiculo text default '',
  placa text default '',
  veiculo_substituto text default '',
  motorista_codigo text default '',
  carga text default '',
  mpd text default '',
  hora_mpd text default '',
  classificacao text default '',
  km_previsto numeric,
  tempo_previsto text default '',
  entregas integer,
  total_caixas numeric,
  ocupacao_caixas_pct numeric,
  total_peso numeric,
  ocupacao_peso_pct numeric,
  eficiencia_pct numeric,
  carga_atual text default '',
  cidades text default '',
  regiao text default '',
  clientes text default '',
  criado_em timestamptz not null default now()
);

create index pcd_mapas_data_idx on public.pcd_mapas (data_entrega);
create index pcd_mapas_placa_idx on public.pcd_mapas (placa);
create index pcd_mapas_motorista_idx on public.pcd_mapas (motorista_codigo);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.pcd_mapas enable row level security;

create policy "pcd_mapas: leitura autenticada"
  on public.pcd_mapas for select to authenticated using (true);

create policy "pcd_mapas: escrita com permissao"
  on public.pcd_mapas for all to authenticated
  using (public.possui_permissao ('pcd.importar'))
  with check (public.possui_permissao ('pcd.importar'));
