alter table public.base_roteirizador add column bairro text;

create or replace view public.consulta_clientes with (security_invoker = true) as
select coalesce(c.codigo, r.codigo) as codigo, coalesce(c.nome, r.nome) as nome,
  r.codigo_roteirizador, r.endereco, r.cidade, r.estado, r.setor, r.latitude, r.longitude,
  r.ultima_compra, r.penultima_compra, r.antepenultima_compra,
  c.codigo is not null as na_base_clientes, r.codigo is not null as na_base_roteirizador,
  r.bairro
from public.base_clientes c full join public.base_roteirizador r using (codigo);

create or replace function public.importar_base_clientes(tipo text, registros jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare total integer;
begin
  if not public.possui_permissao('bases.editar') then
    raise exception 'Sem permissão para importar bases';
  end if;
  if jsonb_typeof(registros) is distinct from 'array' or jsonb_array_length(registros) = 0 then
    raise exception 'Base sem registros';
  end if;
  if tipo = 'clientes' then
    insert into public.base_clientes (codigo, nome)
    select x.codigo, x.nome from jsonb_to_recordset(registros) as x(codigo text, nome text)
    on conflict (codigo) do update set nome = excluded.nome, atualizado_em = now();
  elsif tipo = 'roteirizador' then
    insert into public.base_roteirizador (codigo, nome, codigo_roteirizador, endereco, cidade, estado, setor,
      latitude, longitude, ultima_compra, penultima_compra, antepenultima_compra, bairro)
    select x.codigo, x.nome, x.codigo_roteirizador, x.endereco, x.cidade, x.estado, x.setor,
      x.latitude, x.longitude, x.ultima_compra, x.penultima_compra, x.antepenultima_compra, x.bairro
    from jsonb_to_recordset(registros) as x(codigo text, nome text, codigo_roteirizador text,
      endereco text, cidade text, estado text, setor text, latitude double precision,
      longitude double precision, ultima_compra date, penultima_compra date, antepenultima_compra date, bairro text)
    on conflict (codigo) do update set nome = excluded.nome, codigo_roteirizador = excluded.codigo_roteirizador,
      endereco = excluded.endereco, cidade = excluded.cidade, estado = excluded.estado, setor = excluded.setor,
      latitude = excluded.latitude, longitude = excluded.longitude, ultima_compra = excluded.ultima_compra,
      penultima_compra = excluded.penultima_compra, antepenultima_compra = excluded.antepenultima_compra,
      bairro = coalesce(excluded.bairro, base_roteirizador.bairro), atualizado_em = now();
  else
    raise exception 'Tipo de base inválido';
  end if;
  get diagnostics total = row_count;
  return total;
end;
$$;
