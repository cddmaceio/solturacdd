alter table public.pcd_mapas
  add column if not exists transportadora text not null default '10';
