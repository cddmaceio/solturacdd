-- O arquivo é imutável apenas nos dias passados. Fechamentos explícitos no
-- PCD retiram pendências de hoje/futuro; ausência no CSV não prova fechamento.
create function public.filtrar_pendencias_fechadas(p_snapshot jsonb, p_data date)
returns jsonb language sql stable security invoker set search_path = public as $$
  select case when p_snapshot is null then null else jsonb_set(p_snapshot, '{rotas}',
    coalesce((select jsonb_agg(r.value order by r.ordinality)
      from jsonb_array_elements(p_snapshot->'rotas') with ordinality r(value, ordinality)
      where not exists (
        select 1 from public.pcd_mapas p
        where p.data_entrega < p_data
          and p.data_entrega::text = r.value->>'data_entrega'
          and p.mapa = r.value->>'mapa'
          and upper(trim(p.placa)) = upper(trim(r.value->>'placa'))
          and upper(trim(p.mpd)) in ('PC FINANCEIRA', 'PCD FINANCEIRA', 'PC FISICA', 'PCD FISICA', 'PC FÍSICA', 'PCD FÍSICA')
      )), '[]'::jsonb)) end;
$$;

create function public.limpar_pendencias_escala_atual()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.data_operacao >= (now() at time zone 'America/Maceio')::date then
    new.snapshot := public.filtrar_pendencias_fechadas(new.snapshot, new.data_operacao);
  end if;
  return new;
end;
$$;
create trigger limpar_pendencias_escala_atual
before insert or update of snapshot on public.escalas
for each row execute function public.limpar_pendencias_escala_atual();

-- A importação também atualiza escalas já criadas, inclusive sem abrir a tela.
-- O definer permite a correção para quem importa PCD sem permissão de editar equipe.
create function public.aplicar_fechamento_pcd_na_escala()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if upper(trim(new.mpd)) in ('PC FINANCEIRA', 'PCD FINANCEIRA', 'PC FISICA', 'PCD FISICA', 'PC FÍSICA', 'PCD FÍSICA') then
    update public.escalas e
      set snapshot = public.filtrar_pendencias_fechadas(e.snapshot, e.data_operacao)
      where e.data_operacao >= (now() at time zone 'America/Maceio')::date
        and e.data_operacao > new.data_entrega
        and exists (select 1 from jsonb_array_elements(e.snapshot->'rotas') r
          where r->>'data_entrega' = new.data_entrega::text and r->>'mapa' = new.mapa
            and upper(trim(r->>'placa')) = upper(trim(new.placa)));
  end if;
  return new;
end;
$$;
revoke all on function public.aplicar_fechamento_pcd_na_escala() from public;
create trigger aplicar_fechamento_pcd_na_escala
after insert or update of mpd on public.pcd_mapas
for each row execute function public.aplicar_fechamento_pcd_na_escala();

-- Corrige as pendências já arquivadas hoje/futuro, sem mudar equipes ou passado.
update public.escalas e
set snapshot = public.filtrar_pendencias_fechadas(e.snapshot, e.data_operacao)
where e.data_operacao >= (now() at time zone 'America/Maceio')::date
  and e.snapshot is distinct from public.filtrar_pendencias_fechadas(e.snapshot, e.data_operacao);
