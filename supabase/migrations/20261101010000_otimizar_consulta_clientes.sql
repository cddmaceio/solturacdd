-- Calcula as permissões uma vez por consulta, em vez de por cadastro.
alter policy "clientes: consulta" on public.base_clientes using (
  (select public.possui_permissao('bases.visualizar')) or (select public.possui_permissao('pcd.visualizar'))
);
alter policy "roteirizador: consulta" on public.base_roteirizador using (
  (select public.possui_permissao('bases.visualizar')) or (select public.possui_permissao('pcd.visualizar'))
);
alter policy "clientes: importar" on public.base_clientes
  using ((select public.possui_permissao('bases.editar')))
  with check ((select public.possui_permissao('bases.editar')));
alter policy "roteirizador: importar" on public.base_roteirizador
  using ((select public.possui_permissao('bases.editar')))
  with check ((select public.possui_permissao('bases.editar')));

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create function public.normalizar_busca_cliente(texto text) returns text
language sql immutable strict parallel safe set search_path = pg_catalog as $$
  select translate(upper(btrim(texto)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN');
$$;

-- Índices permitem procurar trechos do nome/código sem transferir toda a base.
create index base_clientes_nome_busca_idx on public.base_clientes
  using gin (public.normalizar_busca_cliente(nome) extensions.gin_trgm_ops);
create index base_roteirizador_nome_busca_idx on public.base_roteirizador
  using gin (public.normalizar_busca_cliente(nome) extensions.gin_trgm_ops);
create index base_clientes_codigo_busca_idx on public.base_clientes using gin (codigo extensions.gin_trgm_ops);
create index base_roteirizador_codigo_busca_idx on public.base_roteirizador using gin (codigo extensions.gin_trgm_ops);
create index base_roteirizador_codigo_original_idx on public.base_roteirizador using gin (codigo_roteirizador extensions.gin_trgm_ops);

-- 50 resultados e um registro extra para indicar se há próxima página.
create function public.buscar_clientes(termo text, pagina integer default 0)
returns setof public.consulta_clientes language plpgsql stable security invoker
set search_path = public, pg_catalog as $$
declare
  busca text := public.normalizar_busca_cliente(left(coalesce(termo, ''), 200));
  codigo_exato text;
  padrao text;
begin
  if busca = '' then return; end if;
  if busca ~ '^[0-9]+$' then
    busca := coalesce(nullif(ltrim(busca, '0'), ''), '0');
    select v.codigo into codigo_exato from public.consulta_clientes v where v.codigo = busca;
    if codigo_exato is null and left(busca, 3) = '157' and length(busca) > 3 then
      select v.codigo into codigo_exato from public.consulta_clientes v
        where v.codigo = coalesce(nullif(ltrim(substr(busca, 4), '0'), ''), '0');
    end if;
    if codigo_exato is not null then
      if coalesce(pagina, 0) <= 0 then
        return query select v.* from public.consulta_clientes v where v.codigo = codigo_exato;
      end if;
      return;
    end if;
  elsif length(busca) < 3 then return;
  end if;
  -- %, _ e barra são texto literal digitado pelo usuário, não curingas de SQL.
  padrao := '%' || replace(replace(replace(busca, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  return query
    with encontrados as (
      select c.codigo from public.base_clientes c
        where c.codigo like padrao or public.normalizar_busca_cliente(c.nome) like padrao
      union
      select r.codigo from public.base_roteirizador r
        where r.codigo like padrao or r.codigo_roteirizador like padrao
          or public.normalizar_busca_cliente(r.nome) like padrao
    ), pagina_codigos as (
      select e.codigo, coalesce(c.nome, r.nome) as nome from encontrados e
        left join public.base_clientes c using (codigo)
        left join public.base_roteirizador r using (codigo)
        order by nome, e.codigo
        limit 51 offset greatest(coalesce(pagina, 0), 0)::bigint * 50
    )
    select v.* from pagina_codigos p join public.consulta_clientes v using (codigo)
      order by p.nome, p.codigo;
end;
$$;
revoke all on function public.buscar_clientes(text, integer) from public, anon;
grant execute on function public.buscar_clientes(text, integer) to authenticated;
