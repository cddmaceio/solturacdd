-- O retorno libera somente as férias automáticas de hoje. Dias anteriores e
-- ocorrências lançadas ou justificadas manualmente continuam preservados.
create function public.liberar_retorno_ferias()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ativo and upper(trim(new.status)) in ('', 'ATIVO', 'ATIVA', 'DISPONIVEL', 'DISPONÍVEL') then
    delete from public.ausencias a
    where a.data = (now() at time zone 'America/Maceio')::date
      and a.papel = new.tipo::text and a.codigo = new.codigo
      and a.colaborador_id = new.id
      and a.tipo = 'Férias'
      and translate(upper(trim(a.status_base)), 'ÉÊ', 'EE') like '%FERIA%'
      and a.justificativa = 'Férias registradas automaticamente conforme a Base Equipes na data da escala.';
  end if;
  return new;
end;
$$;

revoke all on function public.liberar_retorno_ferias() from public;

create trigger liberar_retorno_ferias
after update of status, ativo on public.colaboradores
for each row
when (old.status is distinct from new.status or old.ativo is distinct from new.ativo)
execute function public.liberar_retorno_ferias();

-- Corrige também quem já retornou antes da instalação desta correção.
delete from public.ausencias a using public.colaboradores c
where c.ativo and upper(trim(c.status)) in ('', 'ATIVO', 'ATIVA', 'DISPONIVEL', 'DISPONÍVEL')
  and a.data = (now() at time zone 'America/Maceio')::date
  and a.papel = c.tipo::text and a.codigo = c.codigo and a.colaborador_id = c.id
  and a.tipo = 'Férias'
  and translate(upper(trim(a.status_base)), 'ÉÊ', 'EE') like '%FERIA%'
  and a.justificativa = 'Férias registradas automaticamente conforme a Base Equipes na data da escala.';
