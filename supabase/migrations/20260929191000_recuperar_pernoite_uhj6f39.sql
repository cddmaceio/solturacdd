-- Participação em 28/09 confirmada pelo supervisor: mapa 574742 de 26/09.
-- O PCD disponível já está fechado: não inventar a fase MPD original.
-- As escolhas de equipe existentes, inclusive o ajudante manual, são preservadas.
update public.escalas e set snapshot = jsonb_build_object(
  'versao', 1,
  'recuperado', true,
  'base', to_jsonb(v),
  'isSpot', false,
  'ajudante_referencia', coalesce(a.codigo, ''),
  'ajudante_referencia_nome', coalesce(a.nome, ''),
  'rotas', jsonb_build_array(
    to_jsonb(m) || jsonb_build_object('mpd', 'Pernoite recuperado', 'hora_mpd', null)
  )
)
from public.pcd_mapas m
join public.veiculos v on upper(trim(v.placa)) = upper(trim(m.placa))
left join public.colaboradores d on d.tipo = 'motorista' and d.codigo = v.motorista_fixo_codigo
left join public.equipes eq on eq.motorista_id = d.id
left join public.colaboradores a on a.id = eq.ajudante_id
where e.data_operacao = date '2026-09-28'
  and upper(trim(e.veiculo_placa)) = 'UHJ6F39'
  and e.motorista_codigo = '296'
  and e.snapshot is null
  and upper(trim(m.placa)) = 'UHJ6F39'
  and m.data_entrega = date '2026-09-26'
  and m.mapa = '574742'
  and m.motorista_codigo = '296';
