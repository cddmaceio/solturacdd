import { describe, expect, it } from 'vitest'
import { classificarMapa, resumoOperacional } from './lib'
import type { PcdMapa, Veiculo } from '@/types/dominio'

const DATA = '2026-09-28'

function mapa(extra: Partial<PcdMapa> = {}): PcdMapa {
  return {
    id: 'm1',
    data_entrega: DATA,
    mapa: 'M1',
    roadshow: null,
    transportadora: '10',
    as_rota: 'Rota',
    armazem: null,
    tipo_veiculo: 'VUC',
    placa: 'ABC1234',
    veiculo_substituto: null,
    motorista_codigo: null,
    carga: 'Fixa',
    mpd: 'GERADO',
    hora_mpd: null,
    classificacao: null,
    km_previsto: null,
    tempo_previsto: null,
    entregas: null,
    total_caixas: null,
    ocupacao_caixas_pct: null,
    total_peso: null,
    ocupacao_peso_pct: null,
    eficiencia_pct: null,
    carga_atual: null,
    cidades: null,
    regiao: null,
    clientes: null,
    ...extra,
  }
}

function veiculo(placa: string, tipo = 'TRUCK'): Veiculo {
  return {
    id: placa,
    placa,
    tipo_veiculo: tipo,
    frota: null,
    disponibilidade: null,
    territorio: null,
    motorista_fixo_codigo: null,
    motorista_fixo_nome: null,
    ativo: true,
  }
}

describe('classificarMapa', () => {
  const frota = new Set(['ABC1234'])
  const vans = new Set(['VAN1234'])

  it('aplica precedência Zumpy, Spot e AS antes da categoria de frota', () => {
    expect(classificarMapa(mapa({ transportadora: '54', carga: 'Freteiro', as_rota: 'AS' }), frota, vans)).toBe('zumpy')
    expect(classificarMapa(mapa({ carga: 'Freteiro', as_rota: 'AS' }), frota, vans)).toBe('spot')
    expect(classificarMapa(mapa({ as_rota: 'AS' }), frota, vans)).toBe('as')
  })

  it('distingue Vans da frota fixa por tipo cadastrada na Base Fidelização', () => {
    expect(classificarMapa(mapa({ placa: 'VAN1234' }), new Set(['VAN1234']), vans)).toBe('vans')
    expect(classificarMapa(mapa(), frota, vans)).toBe('frota')
  })
})

describe('resumoOperacional', () => {
  it('separa recargas, calcula mapas/carros D0 e conta pendências abertas', () => {
    const dados = resumoOperacional(
      [
        mapa({ id: '1', placa: 'ABC1234' }),
        mapa({ id: '2', placa: 'ABC1234', mapa: 'M2' }),
        mapa({ id: '3', placa: 'REC0001', mapa: 'REC1', carga_atual: 'RECARGA' }),
        mapa({ id: '4', placa: 'XYZ1234', data_entrega: '2026-09-27', mpd: 'EMITIDO' }),
        mapa({ id: '5', placa: 'XYZ1234', mapa: 'FECHADO', data_entrega: '2026-09-27', mpd: 'PC FINANCEIRA' }),
      ],
      [veiculo('ABC1234')],
      DATA,
    )
    expect(dados.mapasD0).toBe(3)
    expect(dados.carrosD0).toBe(1)
    expect(dados.recargasD0).toBe(1)
    expect(dados.pernoites).toBe(1)
    expect(dados.carrosPernoite).toBe(1)
    expect(dados.categorias).toMatchObject([{ chave: 'frota', mapas: 2, carros: 1 }])
  })
})
