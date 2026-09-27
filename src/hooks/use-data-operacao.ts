import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useUltimaDataPcd } from '@/features/pcd/api'
import { dataPreferida, paraDmy, paraIso } from '@/lib/datas'

/**
 * Data de operação compartilhada entre as telas (ex.: /escala?data=2026-09-26).
 * Sem parâmetro, inicia em hoje e adota a data preferida do PCD quando ela
 * estiver disponível (hoje se o último mapa for de hoje/ontem; senão, a última).
 */
export function useDataOperacao(): {
  dataIso: string
  definirData: (iso: string) => void
  temDataExplicita: boolean
} {
  const [params, setParams] = useSearchParams()
  const dataIso = params.get('data') ?? new Date().toISOString().slice(0, 10)
  const temDataExplicita = params.has('data')
  const { data: ultimaData, isLoading: carregandoUltimaData } = useUltimaDataPcd()
  const ultimaDataAdotada = useRef<string | null>(null)

  const definirData = useCallback(
    (iso: string) => {
      const proximas = new URLSearchParams(params)
      proximas.set('data', iso)
      setParams(proximas, { replace: true })
    },
    [params, setParams],
  )

  useEffect(() => {
    if (temDataExplicita || carregandoUltimaData || !ultimaData || ultimaDataAdotada.current === ultimaData) return
    ultimaDataAdotada.current = ultimaData
    const preferida = paraIso(dataPreferida([paraDmy(ultimaData)]))
    if (preferida && preferida !== dataIso) definirData(preferida)
  }, [temDataExplicita, carregandoUltimaData, ultimaData, dataIso, definirData])

  return { dataIso, definirData, temDataExplicita }
}
