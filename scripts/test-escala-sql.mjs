// Run with PGLITE_MODULE pointing to the installed @electric-sql/pglite module.
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = new PGlite()
await db.exec(`
  create schema auth;
  create table auth.users(id uuid primary key);
  create table public.colaboradores(id uuid primary key);
  create role authenticated;
  create function public.possui_permissao(text) returns boolean language sql as $$ select true $$;
  create function public.atualizar_em() returns trigger language plpgsql as $$ begin new.atualizado_em=now(); return new; end $$;
`)
for (const file of ['0005_criar_escalas_ausencias.sql', '0007_escala_marcar_alocacao_manual.sql',
  '20260927135455_add_scale_helper_slots.sql', '20260929190000_preservar_arquivo_escala.sql']) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
}
const mapa = { id: 'old', mapa: '574742', placa: 'UHJ6F39', data_entrega: '2026-09-26', mpd: 'EMITIDO', motorista_codigo: '296' }
const row = { data_operacao: '2026-09-28', veiculo_placa: 'UHJ6F39', motorista_codigo: '296', motorista_nome: 'NELSON',
  ajudante_codigo: '', ajudante_nome: '', ajudante2_codigo: '', ajudante2_nome: '', chapa_codigo: '', chapa_nome: '', sala: 'FORÇA', observacao: '',
  snapshot: { versao: 1, base: null, isSpot: false, ajudante_referencia: '20', rotas: [mapa] } }
const sync = (rows, hoje = '2026-09-28', restaurar = false) => db.query(
  'select public.sincronizar_escala($1,$2,$3,$4) as total', ['2026-09-28', hoje, JSON.stringify(rows), restaurar])
const read = async () => (await db.query('select * from public.escalas order by veiculo_placa')).rows
assert.equal((await sync([row])).rows[0].total, 1)
assert.equal((await sync([row])).rows[0].total, 0)
await sync([{ ...row, snapshot: { ...row.snapshot, rotas: [{ ...mapa, id: 'new', mpd: 'PC financeira' }] } }])
assert.equal((await read())[0].snapshot.rotas[0].mpd, 'EMITIDO')
// Stale client cannot erase supervisor edits.
await db.exec("update public.escalas set motorista_codigo='99', motorista_manual=true, ajudante_manual=true, sala='VANS'")
const nova = { ...mapa, mapa: 'NEW', data_entrega: '2026-09-28' }
await sync([{ ...row, snapshot: { ...row.snapshot, rotas: [mapa, nova] } }])
let saved = (await read())[0]
assert.equal(saved.motorista_codigo, '99')
assert.equal(saved.sala, 'VANS')
assert.equal(saved.snapshot.rotas.length, 2)
// Past consultation and atomic failure.
assert.equal((await sync([{ ...row, veiculo_placa: 'PAST' }], '2026-09-29')).rows[0].total, 0)
await assert.rejects(sync([{ ...row, veiculo_placa: 'FIRST' }, { ...row, data_operacao: '2026-09-27' }]))
assert.equal((await read()).length, 1)
// Explicit restore preserves maps.
await sync([row], '2026-09-29', true)
saved = (await read())[0]
assert.equal(saved.motorista_codigo, '296')
assert.equal(saved.snapshot.rotas.length, 2)
// A late overnight map replaces only the automatic fixed crew.
await db.exec('delete from public.escalas')
await sync([{ ...row, motorista_codigo: '10', ajudante_codigo: '20', snapshot: { ...row.snapshot, rotas: [nova] } }])
await sync([{ ...row, snapshot: { ...row.snapshot, rotas: [nova, mapa] } }])
saved = (await read())[0]
assert.equal(saved.motorista_codigo, '296')
assert.equal(saved.ajudante_codigo, '')
// Empty slots explicitly cleared while client was loading remain empty.
await db.exec('delete from public.escalas')
await sync([{ ...row, motorista_codigo: '', snapshot: { ...row.snapshot, rotas: [] } }])
await db.exec('update public.escalas set motorista_manual=true')
await sync([row])
assert.equal((await read())[0].motorista_codigo, '')
// A different vehicle was manually assigned after this client's read.
await db.exec('delete from public.escalas')
const other = { ...row, veiculo_placa: 'ZZZ1Z11', snapshot: { ...row.snapshot, rotas: [{ ...nova, placa: 'ZZZ1Z11' }] } }
await sync([other])
await db.exec('update public.escalas set motorista_manual=true')
await sync([row])
assert.equal((await read()).find((r) => r.veiculo_placa === row.veiculo_placa).motorista_codigo, '')
assert.equal((await read()).find((r) => r.veiculo_placa === other.veiculo_placa).motorista_codigo, '296')
await db.exec('delete from public.escalas')
await sync([other])
await sync([row])
assert.equal((await read()).find((r) => r.veiculo_placa === row.veiculo_placa).motorista_codigo, '296')
assert.equal((await read()).find((r) => r.veiculo_placa === other.veiculo_placa).motorista_codigo, '')
await db.exec('create or replace function public.possui_permissao(text) returns boolean language sql as $$ select false $$')
await assert.rejects(sync([row]), /Sem permissão/)
await db.close()
console.log('SQL: migration, idempotence, preserved status, stale client, past dates, rollback, restore, late overnight, manual clearing, permissions passed.')
