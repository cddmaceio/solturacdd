import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
const texto = await readFile(new URL('../Credenciais_supabase.txt', import.meta.url), 'utf8')
const url = texto.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(\S+)/)?.[1]
const key = texto.match(/service_role\s*:\s*(eyJ\S+)/)?.[1]
if (!url || !key) throw new Error('Credenciais locais incompletas')
const db = createClient(url, key, { auth: { persistSession: false } })
const hoje = '2026-10-01'
const { data: escalas, error } = await db.from('escalas').select('data_operacao,veiculo_placa,snapshot').gte('data_operacao', hoje)
if (error) throw error
const mapas = []
for (let inicio = 0; ; inicio += 1000) {
  const { data, error } = await db.from('pcd_mapas').select('data_entrega,mapa,placa,mpd').lt('data_entrega', hoje).order('id').range(inicio, inicio + 999)
  if (error) throw error
  mapas.push(...data)
  if (data.length < 1000) break
}
const chave = (m) => [m.data_entrega, m.mapa, String(m.placa).trim().toUpperCase()].join('|')
const fechados = new Set(mapas.filter((m) => /^(PC|PCD) (FINANCEIRA|F[IÍ]SICA)$/i.test(String(m.mpd).trim())).map(chave))
const pendencias = escalas.flatMap((e) => (e.snapshot?.rotas ?? []).filter((m) => m.data_entrega < e.data_operacao && fechados.has(chave(m))).map((m) => ({ data: e.data_operacao, placa: e.veiculo_placa, mapa: m.mapa, entrega: m.data_entrega, statusArquivado: m.mpd })))
console.log(JSON.stringify({ escalasConsultadas: escalas.length, pendenciasFechadasArquivadas: pendencias.length, exemplos: pendencias.slice(0, 8) }, null, 2))
