import { describe, expect, it } from 'vitest'
import { pessoasForaDaEscala } from './api'
import type { Colaborador, EscalaLinha } from '@/types/dominio'

const colaborador = (codigo: string, tipo: 'motorista' | 'ajudante'): Colaborador => ({
  id: codigo, codigo, nome: codigo, tipo, sala: null, status: '', ativo: true,
})

describe('pessoasForaDaEscala', () => {
  const linha = {
    motorista_codigo: '10', ajudante_codigo: '20', ajudante2_codigo: '30', chapa_codigo: '40',
  } as EscalaLinha

  it('retira da lista os dois ajudantes e Chapa/PX da escala selecionada', () => {
    const pessoas = ['20', '30', '40', '50'].map((codigo) => colaborador(codigo, 'ajudante'))
    expect(pessoasForaDaEscala(pessoas, [linha], 'ajudante').map((p) => p.codigo)).toEqual(['50'])
  })

  it('retira motoristas escalados sem confundir códigos dos ajudantes', () => {
    const pessoas = ['10', '20'].map((codigo) => colaborador(codigo, 'motorista'))
    expect(pessoasForaDaEscala(pessoas, [linha], 'motorista').map((p) => p.codigo)).toEqual(['20'])
  })

  it('permite lançar férias de quem ficou fora da escala no dia escolhido', () => {
    const pessoa = { ...colaborador('50', 'motorista'), status: 'Férias' }
    expect(pessoasForaDaEscala([pessoa], [linha], 'motorista')).toEqual([pessoa])
  })

  it('não oferece os códigos reservados de ajudantes', () => {
    const pessoas = ['800', '801', '50'].map((codigo) => colaborador(codigo, 'ajudante'))
    expect(pessoasForaDaEscala(pessoas, [linha], 'ajudante').map((p) => p.codigo)).toEqual(['50'])
  })
})
