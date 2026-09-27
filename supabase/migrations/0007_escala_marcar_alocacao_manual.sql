-- 0007: escala — distingue slot limpo/escolhido manualmente de vaga ainda
-- não inicializada. Vaga vazia sem marca manual recebe a equipe pré-definida
-- do carro (fixos da Base Fidelização) quando há mapa elegível; vaga com
-- marca manual permanece como o usuário deixou.

alter table public.escalas
  add column motorista_manual boolean not null default false,
  add column ajudante_manual boolean not null default false;
