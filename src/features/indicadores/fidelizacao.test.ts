import { describe, expect, it } from 'vitest'
import type { VeiculoEscala } from '@/features/escala/montagem'
import type { EscalaLinha, Veiculo } from '@/types/dominio'
import { analisarFidelizacao, datasPeriodo, veiculoArquivado } from './fidelizacao'

function veiculo(patch: Partial<VeiculoEscala> = {}): VeiculoEscala {
  return {
    chave: 'ABC', placa: 'ABC', isSpot: false,
    base: { motorista_fixo_codigo: '10', motorista_fixo_nome: 'Ana' } as Veiculo,
    rotas: [], carregado: true, temD1: false, motorista_codigo: '10',
    ajudante_codigo: '20', ajudante_referencia: '20', ajudante2_codigo: '',
    chapa_codigo: '', chapa_nome: '', grupo: 'ELITE', observacao: '', ...patch,
  }
}

describe('análise da fidelização', () => {
  it('pondera o período pelos volumes e exclui veículos sem carga ou referência válida', () => {
    const a = analisarFidelizacao([
      { data: '2026-10-01', veiculos: [veiculo()] },
      { data: '2026-10-02', veiculos: [veiculo(), veiculo({ motorista_codigo: '30' }), veiculo({ motorista_codigo: '' }), veiculo({ carregado: false }), veiculo({ base: null }), veiculo({ base: { motorista_fixo_codigo: '800' } as Veiculo }), veiculo({ base: { motorista_fixo_codigo: '10', motorista_fixo_nome: 'PARADO' } as Veiculo })] },
      { data: '2026-10-03', veiculos: [] },
    ], 'motorista')
    expect(a.elegiveis).toBe(4)
    expect(a.fieis).toBe(2)
    expect(a.pct).toBe(50)
    expect(a.evolucao[1].pct).toBeCloseTo(100 / 3)
    expect(a.evolucao[2].pct).toBeNull()
  })

  it('ordena os motivos NOK e calcula participação, acumulado e perda em pontos percentuais', () => {
    const a = analisarFidelizacao([{ data: '2026-10-01', veiculos: [
      veiculo(), veiculo({ motorista_codigo: '30', observacao: 'Folga' }),
      veiculo({ motorista_codigo: '30', observacao: ' FOLGA ' }),
      veiculo({ motorista_codigo: '', observacao: '' }),
      veiculo({ observacao: 'Não deve entrar' }),
    ] }], 'motorista')
    expect(a.pareto).toHaveLength(2)
    expect(a.pareto[0].motivo).toBe('Folga')
    expect(a.pareto[0].quantidade).toBe(2)
    expect(a.pareto[0].pct).toBeCloseTo(200 / 3)
    expect(a.pareto[0].impacto).toBe(40)
    expect(a.pareto[1].motivo).toBe('Sem justificativa')
    expect(a.pareto[1].acumulado).toBe(100)
    expect(a.pareto.reduce((s, p) => s + p.impacto, 0)).toBe(100 - a.pct!)
  })

  it('analisa ajudantes separadamente e preserva o histórico arquivado', () => {
    const linha = { id: '1', veiculo_placa: 'ABC', data_operacao: '2026-10-01',
      motorista_codigo: '10', ajudante_codigo: '30', observacao: 'Troca',
      snapshot: { versao: 1, base: veiculo().base, isSpot: false,
        ajudante_referencia: '20', rotas: [{ data_entrega: '2026-09-30' }] },
    } as EscalaLinha
    const v = veiculoArquivado(linha)!
    expect(v.carregado).toBe(true)
    expect(v.temD1).toBe(true)
    expect(analisarFidelizacao([{ data: linha.data_operacao, veiculos: [v] }], 'ajudante').nok).toBe(1)
    expect(analisarFidelizacao([{ data: linha.data_operacao, veiculos: [v] }], 'motorista').pct).toBe(100)
    expect(veiculoArquivado({ ...linha, snapshot: null })).toBeNull()
  })

  it('gera dias consecutivos incluindo viradas de mês e ano', () => {
    expect(datasPeriodo('2026-01-02', 4)).toEqual(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'])
    const a = analisarFidelizacao([{ data: '2026-01-01', veiculos: [] }], 'motorista')
    expect(a.pct).toBeNull()
    expect(a.pareto).toEqual([])
  })
})
