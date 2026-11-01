-- Bases independentes: atualizar uma fonte preserva os dados da outra.
create table public.base_clientes (
  codigo text primary key check (codigo ~ '^[0-9]+$'),
  nome text not null,
  atualizado_em timestamptz not null default now()
);
create table public.base_roteirizador (
  codigo text primary key check (codigo ~ '^[0-9]+$'),
  nome text not null,
  codigo_roteirizador text not null,
  endereco text, cidade text, estado text, setor text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  ultima_compra date, penultima_compra date, antepenultima_compra date,
  atualizado_em timestamptz not null default now()
);
alter table public.base_clientes enable row level security;
alter table public.base_roteirizador enable row level security;
create policy "clientes: consulta" on public.base_clientes for select to authenticated
  using (public.possui_permissao('bases.visualizar') or public.possui_permissao('pcd.visualizar'));
create policy "roteirizador: consulta" on public.base_roteirizador for select to authenticated
  using (public.possui_permissao('bases.visualizar') or public.possui_permissao('pcd.visualizar'));
create policy "clientes: importar" on public.base_clientes for all to authenticated
  using (public.possui_permissao('bases.editar')) with check (public.possui_permissao('bases.editar'));
create policy "roteirizador: importar" on public.base_roteirizador for all to authenticated
  using (public.possui_permissao('bases.editar')) with check (public.possui_permissao('bases.editar'));
grant select, insert, update on public.base_clientes, public.base_roteirizador to authenticated;

create view public.consulta_clientes with (security_invoker = true) as
select coalesce(c.codigo, r.codigo) as codigo, coalesce(c.nome, r.nome) as nome,
  r.codigo_roteirizador, r.endereco, r.cidade, r.estado, r.setor, r.latitude, r.longitude,
  r.ultima_compra, r.penultima_compra, r.antepenultima_compra,
  c.codigo is not null as na_base_clientes, r.codigo is not null as na_base_roteirizador
from public.base_clientes c full join public.base_roteirizador r using (codigo);
grant select on public.consulta_clientes to authenticated;

-- Uma transação por arquivo: qualquer falha desfaz a importação inteira.
create function public.importar_base_clientes(tipo text, registros jsonb)
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
      latitude, longitude, ultima_compra, penultima_compra, antepenultima_compra)
    select x.codigo, x.nome, x.codigo_roteirizador, x.endereco, x.cidade, x.estado, x.setor,
      x.latitude, x.longitude, x.ultima_compra, x.penultima_compra, x.antepenultima_compra
    from jsonb_to_recordset(registros) as x(codigo text, nome text, codigo_roteirizador text,
      endereco text, cidade text, estado text, setor text, latitude double precision,
      longitude double precision, ultima_compra date, penultima_compra date, antepenultima_compra date)
    on conflict (codigo) do update set nome = excluded.nome, codigo_roteirizador = excluded.codigo_roteirizador,
      endereco = excluded.endereco, cidade = excluded.cidade, estado = excluded.estado, setor = excluded.setor,
      latitude = excluded.latitude, longitude = excluded.longitude, ultima_compra = excluded.ultima_compra,
      penultima_compra = excluded.penultima_compra, antepenultima_compra = excluded.antepenultima_compra,
      atualizado_em = now();
  else
    raise exception 'Tipo de base inválido';
  end if;
  get diagnostics total = row_count;
  return total;
end;
$$;
revoke all on function public.importar_base_clientes(text, jsonb) from public, anon;
grant execute on function public.importar_base_clientes(text, jsonb) to authenticated;
