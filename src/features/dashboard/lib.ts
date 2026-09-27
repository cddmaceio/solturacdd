import { ehFreteiro, ehRecarga, ehZumpy, pendenciaAnterior } from '@/features/pcd/lib'
import { tipoNormalizado } from '@/features/veiculos/lib'
import { norm } from '@/lib/texto'
import type { PcdMapa, Veiculo } from '@/types/dominio'

export type CategoriaOperacional = 'zumpy' | 'spot' | 'as' | 'vans' | 'frota' | 'outros'

export type ResumoCategoria = {
  chave: CategoriaOperacional
  rotulo: string
  mapas: number
  carros: number
  placas: string[]
}

export type PernoitePlaca = {
  placa: string
  mapas: PcdMapa[]
}

export type ResumoOperacional = {
  mapasD0: number
  carrosD0: number
  recargasD0: number
  pernoites: number
  carrosPernoite: number
  categorias: ResumoCategoria[]
  pernoitesPorPlaca: PernoitePlaca[]
}

const CATEGORIAS: { chave: CategoriaOperacional; rotulo: string }[] = [
  { chave: 'frota', rotulo: 'Rota · frota fixa' },
  { chave: 'vans', rotulo: 'Vans' },
  { chave: 'as', rotulo: 'AS' },
  { chave: 'spot', rotulo: 'SPOT · freteiros' },
  { chave: 'zumpy', rotulo: 'Zumpy' },
  { chave: 'outros', rotulo: 'Outros' },
]

export function classificarMapa(
  mapa: PcdMapa,
  placasFrota: Set<string>,
  placasVan: Set<string>,
): CategoriaOperacional {
  if (ehZumpy(mapa)) return 'zumpy'
  if (ehFreteiro(mapa)) return 'spot'
  if (norm(mapa.as_rota) === 'AS') return 'as'
  const placa = norm(mapa.placa)
  if (placa && placasVan.has(placa)) return 'vans'
  if (placa && placasFrota.has(placa)) return 'frota'
  return 'outros'
}

export function resumoOperacional(
  mapas: PcdMapa[],
  veiculos: Veiculo[],
  dataIso: string,
): ResumoOperacional {
  const d0 = mapas.filter((mapa) => mapa.data_entrega === dataIso)
  const recargas = d0.filter(ehRecarga)
  const paraDistribuicao = d0.filter((mapa) => !ehRecarga(mapa))
  const placasFrota = new Set(veiculos.map((v) => norm(v.placa)).filter(Boolean))
  const placasVan = new Set(
    veiculos.filter((v) => tipoNormalizado(v.tipo_veiculo) === 'VAN').map((v) => norm(v.placa)),
  )
  const porCategoria = new Map<CategoriaOperacional, Set<string>>()
  const mapasPorCategoria = new Map<CategoriaOperacional, number>()

  for (const mapa of paraDistribuicao) {
    const categoria = classificarMapa(mapa, placasFrota, placasVan)
    mapasPorCategoria.set(categoria, (mapasPorCategoria.get(categoria) ?? 0) + 1)
    const placa = String(mapa.placa ?? '').trim()
    if (placa) {
      if (!porCategoria.has(categoria)) porCategoria.set(categoria, new Set())
      porCategoria.get(categoria)!.add(norm(placa))
    }
  }

  const categorias = CATEGORIAS.map(({ chave, rotulo }) => {
    const placas = [...(porCategoria.get(chave) ?? [])].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return { chave, rotulo, mapas: mapasPorCategoria.get(chave) ?? 0, carros: placas.length, placas }
  }).filter((categoria) => categoria.mapas > 0)

  const pendentes = mapas.filter((mapa) => pendenciaAnterior(mapa, dataIso))
  const pernoitesPorPlacaMap = new Map<string, PcdMapa[]>()
  for (const mapa of pendentes) {
    const placa = String(mapa.placa ?? '').trim() || 'SEM PLACA'
    if (!pernoitesPorPlacaMap.has(placa)) pernoitesPorPlacaMap.set(placa, [])
    pernoitesPorPlacaMap.get(placa)!.push(mapa)
  }
  const pernoitesPorPlaca = [...pernoitesPorPlacaMap.entries()]
    .map(([placa, lista]) => ({
      placa,
      mapas: [...lista].sort((a, b) => b.data_entrega.localeCompare(a.data_entrega)),
    }))
    .sort((a, b) => a.placa.localeCompare(b.placa, 'pt-BR', { numeric: true }))

  const placasD0 = new Set(d0.filter((mapa) => !ehRecarga(mapa)).map((mapa) => norm(mapa.placa)).filter(Boolean))
  return {
    mapasD0: d0.length,
    carrosD0: placasD0.size,
    recargasD0: recargas.length,
    pernoites: pendentes.length,
    carrosPernoite: pernoitesPorPlaca.length,
    categorias,
    pernoitesPorPlaca,
  }
}
