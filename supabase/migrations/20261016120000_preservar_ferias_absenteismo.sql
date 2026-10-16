-- Férias da base viram registros da data, preservados após o retorno ao trabalho.
-- A execução diferida consulta a escala completa ao fim da transação, inclusive
-- ajudante 2 e Chapa/PX. Nunca deduz férias em dias passados ou futuros.
create function public.registrar_ferias_da_escala()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.data_operacao <> (now() at time zone 'America/Maceio')::date
    or not public.possui_permissao('escala.editar') then
    return null;
  end if;

  insert into public.ausencias (data, papel, codigo, nome, colaborador_id, tipo, justificativa, status_base)
  select new.data_operacao, c.tipo::text, c.codigo, c.nome, c.id, 'Férias',
    'Férias registradas automaticamente conforme a Base Equipes na data da escala.', c.status
  from public.colaboradores c
  where c.ativo
    and translate(upper(trim(c.status)), 'ÉÊ', 'EE') like '%FERIA%'
    and not (c.tipo::text = 'ajudante' and c.codigo in ('800', '801'))
    and exists (select 1 from public.escalas e where e.data_operacao = new.data_operacao)
    and not exists (
      select 1 from public.escalas e
      where e.data_operacao = new.data_operacao and (
        (c.tipo::text = 'motorista' and trim(e.motorista_codigo) = trim(c.codigo))
        or (c.tipo::text = 'ajudante' and trim(c.codigo) in
          (trim(e.ajudante_codigo), trim(e.ajudante2_codigo), trim(e.chapa_codigo)))
      )
    )
  on conflict (data, papel, codigo) do nothing;
  return null;
end;
$$;

revoke all on function public.registrar_ferias_da_escala() from public;

create constraint trigger registrar_ferias_da_escala
after insert or update on public.escalas
deferrable initially deferred
for each row execute function public.registrar_ferias_da_escala();
