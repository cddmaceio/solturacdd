import { codigosDoMapa, localizarCliente, temLocalizacao, type Cliente } from '@/features/clientes/lib'

export type ClienteVeiculo = {
  codigo: string
  cliente: Cliente | undefined
  mapas: string[]
  localizado: boolean
}

export function clientesDoVeiculo(rotas: { mapa: string; clientes: string | null }[], clientes: Cliente[]): ClienteVeiculo[] {
  const indice = new Map(clientes.map((c) => [c.codigo, c]))
  const resultado = new Map<string, ClienteVeiculo>()
  for (const rota of rotas) {
    for (const codigoOriginal of codigosDoMapa(rota.clientes)) {
      const cliente = localizarCliente(codigoOriginal, indice)
      const codigo = cliente?.codigo ?? codigoOriginal
      const existente = resultado.get(codigo)
      if (existente) {
        if (!existente.mapas.includes(rota.mapa)) existente.mapas.push(rota.mapa)
      } else {
        resultado.set(codigo, { codigo, cliente, mapas: [rota.mapa], localizado: !!cliente && temLocalizacao(cliente) })
      }
    }
  }
  return [...resultado.values()].sort((a, b) => (a.cliente?.nome ?? a.codigo).localeCompare(b.cliente?.nome ?? b.codigo, 'pt-BR', { numeric: true }))
}
