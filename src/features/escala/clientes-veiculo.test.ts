import { describe, expect, it } from 'vitest'
import { clientesDoVeiculo } from './clientes-veiculo'
import type { Cliente } from '@/features/clientes/lib'

describe('clientes do veículo', () => {
  it('reúne clientes de todos os mapas, normaliza códigos e mantém as referências sem duplicar pontos', () => {
    const cliente = { codigo: '42234', nome: 'Mercado', latitude: -9.6, longitude: -35.7 } as Cliente
    const resultado = clientesDoVeiculo([
      { mapa: 'D0', clientes: '0042234/0099999' },
      { mapa: 'PENDENTE', clientes: '15742234/42234' },
    ], [cliente])
    expect(resultado).toHaveLength(2)
    expect(resultado.find((c) => c.codigo === '42234')).toEqual({ codigo: '42234', cliente, mapas: ['D0', 'PENDENTE'], localizado: true })
    expect(resultado.find((c) => c.codigo === '99999')).toMatchObject({ localizado: false, cliente: undefined })
  })
  it('não apresenta coordenadas vazias ou inválidas como pontos', () => {
    const clientes = [
      { codigo: '1', latitude: null, longitude: null },
      { codigo: '2', latitude: 0, longitude: 0 },
      { codigo: '3', latitude: 91, longitude: 0 },
    ] as Cliente[]
    expect(clientesDoVeiculo([{ mapa: 'A', clientes: '1/2/3' }], clientes).every((c) => !c.localizado)).toBe(true)
    expect(clientesDoVeiculo([{ mapa: 'A', clientes: null }], clientes)).toEqual([])
  })
})
