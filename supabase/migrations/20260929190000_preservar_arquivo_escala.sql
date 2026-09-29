-- NULL identifica o legado: não existe prova dos mapas que compunham esse dia.
alter table public.escalas add column snapshot jsonb;
alter table public.escalas add constraint escalas_snapshot_valido check (
  snapshot is null or (
    snapshot->>'versao' = '1' and jsonb_typeof(snapshot->'rotas') = 'array'
  )
);

-- Uma transação por data; reimportações nunca substituem mapas arquivados.
-- SECURITY INVOKER conserva a RLS e as permissões existentes.
create function public.sincronizar_escala(
  p_data date, p_hoje date, p_linhas jsonb, p_restaurar boolean default false
) returns integer language plpgsql security invoker set search_path = public as $$
declare
  item jsonb;
  atual public.escalas%rowtype;
  proposta public.escalas%rowtype;
  novo_snapshot jsonb;
  rota jsonb;
  primeiro_mapa boolean;
  novo_pernoite boolean;
  slot text;
  codigo_novo text;
  ocupado boolean;
  patch jsonb;
  total integer := 0;
begin
  if not public.possui_permissao('escala.editar') then
    raise exception 'Sem permissão para editar a escala';
  end if;
  if not p_restaurar and p_data < p_hoje then return 0; end if;
  perform pg_advisory_xact_lock(hashtextextended('escala:' || p_data::text, 0));
  for item in select value from jsonb_array_elements(p_linhas) loop
    proposta := jsonb_populate_record(null::public.escalas, item);
    if proposta.data_operacao is distinct from p_data or proposta.snapshot is null then
      raise exception 'Linha inválida para a escala';
    end if;
    select * into atual from public.escalas
      where data_operacao = p_data and veiculo_placa = proposta.veiculo_placa for update;
    if not found then
      if p_restaurar then continue; end if;
      insert into public.escalas (data_operacao, veiculo_placa, sala, observacao)
        values (p_data, proposta.veiculo_placa, proposta.sala, proposta.observacao)
        returning * into atual;
    end if;
    if p_restaurar then
      -- A ação explícita restaura a equipe, nunca descarta o arquivo de mapas.
      update public.escalas set
        motorista_codigo = proposta.motorista_codigo, motorista_nome = proposta.motorista_nome, motorista_manual = false,
        ajudante_codigo = proposta.ajudante_codigo, ajudante_nome = proposta.ajudante_nome, ajudante_manual = false,
        ajudante2_codigo = proposta.ajudante2_codigo, ajudante2_nome = proposta.ajudante2_nome, ajudante2_manual = false,
        chapa_codigo = proposta.chapa_codigo, chapa_nome = proposta.chapa_nome, chapa_manual = false,
        sala = proposta.sala, observacao = proposta.observacao
      where id = atual.id;
      total := total + 1;
      continue;
    end if;
    primeiro_mapa := coalesce(jsonb_array_length(atual.snapshot->'rotas'), 0) = 0
      and jsonb_array_length(proposta.snapshot->'rotas') > 0;
    select exists (
      select 1 from (
        select value as r from jsonb_array_elements(proposta.snapshot->'rotas')
        where (value->>'data_entrega')::date < p_data
          and coalesce(trim(value->>'motorista_codigo'), '') not in ('', '800')
          and coalesce(upper(trim(value->>'mpd')), '') not in ('', 'PC FINANCEIRA', 'PCD FINANCEIRA', 'PC FISICA', 'PCD FISICA')
        order by value->>'data_entrega' desc, length(value->>'mapa') desc, value->>'mapa' desc limit 1
      ) candidato
      where not exists (
          select 1 from jsonb_array_elements(coalesce(atual.snapshot->'rotas', '[]'::jsonb)) antigo
          where antigo->>'data_entrega' = r->>'data_entrega' and antigo->>'mapa' = r->>'mapa'
            and upper(trim(antigo->>'placa')) = upper(trim(r->>'placa'))
        )
    ) into novo_pernoite;
    novo_snapshot := coalesce(atual.snapshot, proposta.snapshot);
    for rota in select value from jsonb_array_elements(proposta.snapshot->'rotas') loop
      if not exists (
        select 1 from jsonb_array_elements(novo_snapshot->'rotas') r
        where r->>'data_entrega' = rota->>'data_entrega' and r->>'mapa' = rota->>'mapa'
          and upper(trim(r->>'placa')) = upper(trim(rota->>'placa'))
      ) then
        novo_snapshot := jsonb_set(novo_snapshot, '{rotas}', (novo_snapshot->'rotas') || jsonb_build_array(rota));
      end if;
    end loop;
    patch := '{}'::jsonb;
    if primeiro_mapa then
      foreach slot in array array['motorista', 'ajudante', 'ajudante2', 'chapa'] loop
        if coalesce(to_jsonb(atual)->>(slot || '_codigo'), '') = ''
          and not coalesce((to_jsonb(atual)->>(slot || '_manual'))::boolean, false)
          and (slot <> 'chapa' or coalesce(atual.chapa_nome, '') = '') then
          patch := patch || jsonb_build_object(
            slot || '_codigo', item->>(slot || '_codigo'), slot || '_nome', item->>(slot || '_nome')
          );
        end if;
      end loop;
    end if;
    if novo_pernoite then
      if not coalesce(atual.motorista_manual, false) then
        patch := patch || jsonb_build_object('motorista_codigo', proposta.motorista_codigo, 'motorista_nome', proposta.motorista_nome);
      end if;
      if not coalesce(atual.ajudante_manual, false)
        and coalesce(atual.ajudante_codigo, '') = coalesce(novo_snapshot->>'ajudante_referencia', '') then
        patch := patch || jsonb_build_object('ajudante_codigo', '', 'ajudante_nome', '');
      end if;
    end if;
    -- Reconsulta as ocupações no banco: o cliente pode ter carregado antes de
    -- outro supervisor atribuir a pessoa. Pernoite vence só sugestões automáticas.
    foreach slot in array array['motorista', 'ajudante', 'ajudante2', 'chapa'] loop
      codigo_novo := coalesce(patch->>(slot || '_codigo'), '');
      if codigo_novo = '' or (slot <> 'motorista' and codigo_novo in ('800', '801')) then continue; end if;
      if slot = 'motorista' then
        if novo_pernoite then
          select exists(select 1 from public.escalas e where e.data_operacao = p_data
            and e.id <> atual.id and e.motorista_codigo = codigo_novo and e.motorista_manual) into ocupado;
          if not ocupado then
            update public.escalas e set motorista_codigo = '', motorista_nome = ''
              where e.data_operacao = p_data and e.id <> atual.id
                and e.motorista_codigo = codigo_novo and not e.motorista_manual;
          end if;
        else
          select exists(select 1 from public.escalas e where e.data_operacao = p_data
            and e.id <> atual.id and e.motorista_codigo = codigo_novo) into ocupado;
        end if;
      else
        select exists(select 1 from public.escalas e where e.data_operacao = p_data
          and e.id <> atual.id and codigo_novo in (e.ajudante_codigo, e.ajudante2_codigo, e.chapa_codigo)) into ocupado;
      end if;
      if ocupado then
        patch := patch || jsonb_build_object(slot || '_codigo', '', slot || '_nome', '');
      end if;
    end loop;
    if atual.snapshot is distinct from novo_snapshot or patch <> '{}'::jsonb then
      atual := jsonb_populate_record(atual, patch);
      update public.escalas set snapshot = novo_snapshot,
        motorista_codigo = atual.motorista_codigo, motorista_nome = atual.motorista_nome,
        ajudante_codigo = atual.ajudante_codigo, ajudante_nome = atual.ajudante_nome,
        ajudante2_codigo = atual.ajudante2_codigo, ajudante2_nome = atual.ajudante2_nome,
        chapa_codigo = atual.chapa_codigo, chapa_nome = atual.chapa_nome
      where id = atual.id;
      total := total + 1;
    end if;
  end loop;
  return total;
end;
$$;
revoke all on function public.sincronizar_escala(date, date, jsonb, boolean) from public;
grant execute on function public.sincronizar_escala(date, date, jsonb, boolean) to authenticated;
