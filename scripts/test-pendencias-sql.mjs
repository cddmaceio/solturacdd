import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = new PGlite()
await db.exec(`create table pcd_mapas(data_entrega date, mapa text, placa text, mpd text);
create table escalas(data_operacao date, snapshot jsonb, motorista_codigo text);
insert into pcd_mapas values ('2099-09-30','M','ABC1D23','pc financeira');
insert into escalas values ('2099-10-01','{"rotas":[{"data_entrega":"2099-09-30","mapa":"M","placa":"abc1d23","mpd":"Carregado"}]}','99'),
('2020-10-01','{"rotas":[{"data_entrega":"2099-09-30","mapa":"M","placa":"abc1d23"}]}','99');`)
await db.exec(await readFile(new URL('../supabase/migrations/20261001120000_remover_pendencias_fechadas_atuais.sql', import.meta.url), 'utf8'))
const read = async (date) => (await db.query('select * from escalas where data_operacao=$1', [date])).rows[0]
assert.deepEqual((await read('2099-10-01')).snapshot.rotas, [])
assert.equal((await read('2099-10-01')).motorista_codigo, '99')
assert.equal((await read('2020-10-01')).snapshot.rotas.length, 1)
// Um cliente antigo não pode recolocar um mapa fechado.
await db.exec(`update escalas set snapshot='{"rotas":[{"data_entrega":"2099-09-30","mapa":"M","placa":"ABC1D23"}]}' where data_operacao='2099-10-01'`)
assert.deepEqual((await read('2099-10-01')).snapshot.rotas, [])
// Ausência no PCD conserva a rota; importar fechamento remove só a anterior.
await db.exec(`update escalas set snapshot='{"rotas":[{"data_entrega":"2099-09-30","mapa":"N","placa":"ABC1D23"},{"data_entrega":"2099-10-01","mapa":"D0","placa":"ABC1D23"}]}' where data_operacao='2099-10-01'`)
assert.equal((await read('2099-10-01')).snapshot.rotas.length, 2)
await db.exec(`insert into pcd_mapas values ('2099-09-30','N','ABC1D23','PC física'),('2099-10-01','D0','ABC1D23','PC financeira')`)
assert.equal((await read('2099-10-01')).snapshot.rotas.length, 1)
assert.equal((await read('2099-10-01')).snapshot.rotas[0].mapa, 'D0')
assert.equal((await read('2020-10-01')).snapshot.rotas.length, 1)
await db.close()
console.log('SQL: correção inicial, histórico, equipe, cliente antigo, importação e D0 preservado passaram.')
