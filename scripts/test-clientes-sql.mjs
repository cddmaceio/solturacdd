import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = new PGlite()
await db.exec(`create role authenticated; create role anon;
  create function public.possui_permissao(text) returns boolean language sql as $$ select current_setting('app.editar', true) = 'true' $$;
  set app.editar = 'true';`)
await db.exec(await readFile(new URL('../supabase/migrations/20261031120000_consulta_clientes.sql', import.meta.url), 'utf8'))
const importar = (tipo, registros) => db.query('select public.importar_base_clientes($1, $2::jsonb) as total', [tipo, JSON.stringify(registros)])
await importar('clientes', [{ codigo: '42234', nome: 'Nome fantasia' }])
await importar('roteirizador', [{ codigo: '42234', nome: 'Nome roteirizador', codigo_roteirizador: '15742234', latitude: -9.6, longitude: -35.7 }, { codigo: '999', nome: 'Só roteirizador', codigo_roteirizador: '157999' }])
let linhas = (await db.query('select * from consulta_clientes order by codigo')).rows
assert.equal(linhas.length, 2)
assert.equal(linhas[0].nome, 'Nome fantasia')
assert.equal(linhas[0].latitude, -9.6)
assert.equal(linhas[1].na_base_clientes, false)
await importar('clientes', [{ codigo: '42234', nome: 'Nome atualizado' }])
assert.equal((await db.query("select latitude from consulta_clientes where codigo='42234'")).rows[0].latitude, -9.6)
await assert.rejects(importar('clientes', [{ codigo: '42234', nome: 'Não salvar' }, { codigo: 'inválido', nome: 'Erro' }]))
assert.equal((await db.query("select nome from base_clientes where codigo='42234'")).rows[0].nome, 'Nome atualizado')
await db.exec("set role authenticated; set app.editar = 'false'")
await assert.rejects(importar('clientes', [{ codigo: '1', nome: 'Sem permissão' }]))
await assert.rejects(db.query("insert into base_clientes(codigo,nome) values ('1','Sem permissão')"))
assert.equal((await db.query('select * from consulta_clientes')).rows.length, 0)
await db.exec("set app.editar = 'true'")
assert.equal((await db.query('select * from consulta_clientes')).rows.length, 2)
await db.close()
console.log('SQL clientes: cruzamento, prioridade do nome fantasia, atualização independente, transação e permissões passaram.')
