import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { obterSupabase } from '@/lib/supabase'
import { brNum, code } from '@/lib/texto'
import { cabecalhosCsv, separarCsv, textoDoArquivo } from '@/lib/csv'
import type { PcdMapa } from '@/types/dominio'

/** Todos os mapas com data até a informada (D0 e anteriores). */
export function usePcdMapas(dataLimiteIso: string) {
  return useQuery({
    queryKey: ['pcd_mapas', dataLimiteIso],
    queryFn: async (): Promise<PcdMapa[]> => {
      const linhas: PcdMapa[] = []
      // O histórico pode ultrapassar o limite de 1.000 registros do PostgREST.
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await obterSupabase()
          .from('pcd_mapas')
          .select('*')
          .lte('data_entrega', dataLimiteIso)
          .order('data_entrega', { ascending: false })
          .order('mapa', { ascending: true })
          .order('id', { ascending: true })
          .range(inicio, inicio + 999)
        if (error) throw new Error(error.message)
        linhas.push(...((data ?? []) as PcdMapa[]))
        if ((data?.length ?? 0) < 1000) return linhas
      }
    },
  })
}

/** Data de entrega mais recente do PCD (qualquer data). */
export function useUltimaDataPcd() {
  return useQuery({
    queryKey: ['pcd_mapas', 'ultima-data'],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await obterSupabase()
        .from('pcd_mapas')
        .select('data_entrega')
        .order('data_entrega', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data?.data_entrega ?? null
    },
    staleTime: 5 * 60_000,
  })
}

type LinhaPcd = Omit<PcdMapa, 'id'>

function parsearCsv(texto: string): { linhas: LinhaPcd[]; datas: Set<string> } {
  const brutas = separarCsv(texto, ';')
  if (brutas.length < 2) throw new Error('CSV sem dados')
  const { ler } = cabecalhosCsv(brutas[0])

  const datas = new Set<string>()
  const linhas: LinhaPcd[] = []

  for (const linha of brutas.slice(1)) {
    const transportadora = ler(linha, 'Transportadora')
    if (!['10', '54'].includes(transportadora)) continue
    const dataDmy = ler(linha, 'Data Entrega')
    const mapa = ler(linha, 'Nro do Mapa')
    if (!dataDmy || !mapa) continue
    const [dd, mm, aaaa] = dataDmy.split('/')
    if (!dd || !mm || !aaaa) continue
    const dataIso = `${aaaa}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    datas.add(dataIso)

    linhas.push({
      data_entrega: dataIso,
      mapa,
      roadshow: ler(linha, 'Nro do RoadShow'),
      transportadora,
      as_rota: ler(linha, 'AS / Rota'),
      armazem: ler(linha, 'Armazém'),
      tipo_veiculo: ler(linha, 'Veículo'),
      placa: ler(linha, 'Placa').toUpperCase(),
      veiculo_substituto: ler(linha, 'Veiculo Substituto'),
      motorista_codigo: code(ler(linha, 'Motorista')),
      carga: ler(linha, 'Carga'),
      mpd: ler(linha, 'MPD'),
      hora_mpd: ler(linha, 'Hora MPD'),
      classificacao: ler(linha, 'Classificação'),
      km_previsto: brNum(ler(linha, 'KM Prev.')) || null,
      tempo_previsto: ler(linha, 'Tempo Prev. (+almoço)'),
      entregas: ler(linha, 'Entregas') ? Math.round(brNum(ler(linha, 'Entregas'))) : null,
      total_caixas: ler(linha, 'Total de caixas') ? brNum(ler(linha, 'Total de caixas')) : null,
      ocupacao_caixas_pct: ler(linha, '% Ocupação Caixas')
        ? brNum(ler(linha, '% Ocupação Caixas'))
        : null,
      total_peso: ler(linha, 'Total peso') ? brNum(ler(linha, 'Total peso')) : null,
      ocupacao_peso_pct: ler(linha, '% Ocupação Peso') ? brNum(ler(linha, '% Ocupação Peso')) : null,
      eficiencia_pct: ler(linha, '% Eficiência') ? brNum(ler(linha, '% Eficiência')) : null,
      carga_atual: ler(linha, 'Carga Atual'),
      cidades: ler(linha, 'Cidades +Entregas'),
      regiao: ler(linha, 'Região +Entregas'),
      clientes: ler(linha, 'Clientes'),
    })
  }

  return { linhas, datas }
}

/** Importa o CSV do PCD: substitui as linhas das datas presentes no arquivo. */
export function useImportarPcd() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (arquivo: File): Promise<{ total: number; datas: number }> => {
      const texto = await textoDoArquivo(arquivo)
      const { linhas, datas } = parsearCsv(texto)
      if (!linhas.length) {
        throw new Error('CSV sem dados válidos das transportadoras 10 ou 54')
      }

      const db = obterSupabase()
      for (const dataIso of datas) {
        const { error } = await db.from('pcd_mapas').delete().eq('data_entrega', dataIso)
        if (error) throw new Error(error.message)
      }
      for (let i = 0; i < linhas.length; i += 300) {
        const { error } = await db.from('pcd_mapas').insert(linhas.slice(i, i + 300))
        if (error) throw new Error(error.message)
      }
      return { total: linhas.length, datas: datas.size }
    },
    onSuccess: (resultado) => {
      void qc.invalidateQueries({ queryKey: ['pcd_mapas'] })
      void qc.invalidateQueries({ queryKey: ['veiculos'] })
      toast.success(
        `PCD importado: ${resultado.total} mapa(s) em ${resultado.datas} data(s)`,
      )
    },
  })
}
