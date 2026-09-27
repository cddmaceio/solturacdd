alter table public.veiculos
  add column if not exists territorio text default '';
