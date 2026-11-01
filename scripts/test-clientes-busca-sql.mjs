import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const { pg_trgm } = await import(pathToFileURL(path.join(path.dirname(process.env.PGLITE_MODULE), 'contrib/pg_trgm.js')).href)
const db = new PGlite({ extensions: { pg_trgm } })
await db.exec(`create role authenticated; create role anon;
  create function public.possui_permissao(text) returns boolean language sql stable as $$ select current_setting('app.permitir', true) = 'true' $$;
  set app.permitir = 'true';`)
for (const nome of ['20261031120000_consulta_clientes.sql', '20261101010000_otimizar_consulta_clientes.sql', '20261101011000_cliente_bairro.sql']) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${nome}`, import.meta.url), 'utf8'))
}
await db.exec(`insert into base_clientes(codigo,nome) values
  ('42234','Mercado São José'),('15742234','Código exato prioritário'),('99','Loja 100%_ Real');
  insert into base_roteirizador(codigo,nome,codigo_roteirizador) values
  ('42234','Nome alternativo','15742234'),('48184','Só roteirizador','15748184');
  insert into base_clientes(codigo,nome) select (100000+i)::text,'Paginação '||lpad(i::text,3,'0') from generate_series(1,125) i;`)
const buscar = async (termo, pagina = 0) => (await db.query('select * from public.buscar_clientes($1,$2)', [termo, pagina])).rows
assert.equal((await buscar('')).length, 0)
assert.equal((await buscar('me')).length, 0)
assert.equal((await buscar('0042234'))[0].nome, 'Mercado São José')
assert.equal((await buscar('15742234'))[0].nome, 'Código exato prioritário')
assert.equal((await buscar('015748184'))[0].codigo, '48184')
assert.equal((await buscar('sao jose'))[0].codigo, '42234')
assert.equal((await buscar('SÃO JOSÉ'))[0].codigo, '42234')
assert.equal((await buscar('roteirizador'))[0].codigo, '48184')
assert.equal((await buscar('100%_'))[0].codigo, '99')
assert.equal((await buscar('sem correspondencia')).length, 0)
const paginas = await Promise.all([0, 1, 2].map((p) => buscar('paginacao', p)))
assert.deepEqual(paginas.map((p) => p.length), [51, 51, 25])
assert.equal(new Set(paginas.flatMap((p) => p.slice(0,50).map((c) => c.codigo))).size, 125)
await db.query('select importar_base_clientes($1,$2::jsonb)', ['roteirizador', JSON.stringify([{ codigo: '42234', nome: 'Mercado', codigo_roteirizador: '15742234', bairro: 'Barro Duro' }])])
assert.equal((await buscar('42234'))[0].bairro, 'Barro Duro')
await db.query('select importar_base_clientes($1,$2::jsonb)', ['roteirizador', JSON.stringify([{ codigo: '42234', nome: 'Mercado', codigo_roteirizador: '15742234' }])])
assert.equal((await buscar('42234'))[0].bairro, 'Barro Duro')
await db.exec("set role authenticated; set app.permitir = 'false'")
assert.equal((await buscar('sao jose')).length, 0)
await db.exec("set app.permitir = 'true'")
assert.equal((await buscar('sao jose')).length, 1)
await db.exec('set role anon')
await assert.rejects(buscar('sao jose'))
await db.close()
console.log('SQL busca: índices, código exato/prefixado, acentos, curingas literais, paginação e permissões passaram.')
