// Run with PGLITE_MODULE pointing to @electric-sql/pglite/dist/index.js.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = new PGlite()
await db.exec(`
  create schema auth;
  create table auth.users(id uuid primary key);
  create role authenticated;
  create function public.possui_permissao(text) returns boolean language sql as $$ select true $$;
  create function public.atualizar_em() returns trigger language plpgsql as $$ begin new.atualizado_em=now(); return new; end $$;
`)
for (const file of ['0002_criar_colaboradores_equipes.sql', '0005_criar_escalas_ausencias.sql',
  '20260927135455_add_scale_helper_slots.sql', '20261016120000_preservar_ferias_absenteismo.sql']) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
}
await db.exec(`
  insert into colaboradores(codigo,nome,tipo,status) values
    ('10','Motorista em férias','motorista','Férias'),
    ('11','Motorista ativo','motorista','Disponivel'),
    ('12','Outro afastamento','motorista','INSS'),
    ('20','Ajudante em férias','ajudante','FERIAS'),
    ('30','Ajudante escalado','ajudante','Férias'),
    ('40','Chapa escalado','ajudante','Férias'),
    ('50','Motorista escalado','motorista','Férias'),
    ('60','Ocorrência manual','motorista','Férias'),
    ('800','Reservado','ajudante','Férias'),
    ('801','Reservado','ajudante','Férias');
  insert into ausencias(data,papel,codigo,tipo,justificativa)
    values ((now() at time zone 'America/Maceio')::date,'motorista','60','Atestado','Manter');
`)
// Past/future scales must not use today's status.
await db.exec(`
  insert into escalas(data_operacao,veiculo_placa) values
    ((now() at time zone 'America/Maceio')::date - 1,'PASSADO'),
    ((now() at time zone 'America/Maceio')::date + 1,'FUTURO');
`)
assert.equal((await db.query('select count(*)::int as n from ausencias')).rows[0].n, 1)
// Simulates the synchronization RPC: creates placeholders and fills the crew.
await db.exec(`begin;
  insert into escalas(data_operacao,veiculo_placa)
    values ((now() at time zone 'America/Maceio')::date,'ABC1234');
  update escalas set motorista_codigo='50',ajudante_codigo='20',ajudante2_codigo='30',chapa_codigo='40'
    where veiculo_placa='ABC1234';
  commit;
`)
let records = (await db.query('select codigo,tipo,status_base,justificativa from ausencias order by codigo')).rows
assert.deepEqual(records.map((r) => [r.codigo, r.tipo]), [['10', 'Férias'], ['60', 'Atestado']])
assert.equal(records[0].status_base, 'Férias')
assert.equal(records[1].justificativa, 'Manter')
// Removing the helper from the scale allows the correct daily registration.
await db.exec("update escalas set ajudante_codigo='' where veiculo_placa='ABC1234'")
assert.equal((await db.query("select count(*)::int as n from ausencias where codigo='20'")).rows[0].n, 1)
// The month change and return to active status never erase the dated record.
await db.exec(`update colaboradores set status='Disponivel' where codigo in ('10','20');
  update escalas set observacao='Reconsulta' where veiculo_placa='ABC1234';`)
records = (await db.query('select codigo,tipo,status_base from ausencias order by codigo')).rows
assert.deepEqual(records.map((r) => [r.codigo, r.tipo]), [['10', 'Férias'], ['20', 'Férias'], ['60', 'Atestado']])
assert.equal(records[0].status_base, 'Férias')
// Archived vacation remains in the previous month; the active employee does not
// receive another vacation occurrence when a new daily scale is saved.
await db.exec(`update ausencias
  set data = (date_trunc('month', now() at time zone 'America/Maceio') - interval '1 day')::date
  where codigo in ('10','20');
  update escalas set observacao='Nova sincronização' where veiculo_placa='ABC1234';`)
assert.equal((await db.query(`select count(*)::int as n from ausencias
  where codigo in ('10','20') and data = (now() at time zone 'America/Maceio')::date`)).rows[0].n, 0)
assert.equal((await db.query("select count(*)::int as n from ausencias where codigo in ('10','20') and tipo='Férias'")).rows[0].n, 2)
// A failure rolls back scale and automatic absences together.
await db.exec("insert into colaboradores(codigo,nome,tipo,status) values ('70','Novo','motorista','Férias')")
await assert.rejects(db.exec(`begin;
  update escalas set observacao='Falha' where veiculo_placa='ABC1234';
  select 1/0;
  commit;`))
await db.exec('rollback')
assert.equal((await db.query("select count(*)::int as n from ausencias where codigo='70'")).rows[0].n, 0)
await db.close()
console.log('SQL férias: histórico, retorno, duplicidade, ocorrências manuais, slots, códigos reservados, datas e rollback passaram.')
