drop index if exists public.veiculos_sala_idx;

alter table public.veiculos
  drop column if exists sala,
  drop column if exists ajudante_fixo_codigo,
  drop column if exists ajudante_fixo_nome;
