import { describe, expect, it } from 'vitest'
import { colaboradorDisponivel } from './disponibilidade'
import type { Colaborador } from '@/types/dominio'

describe.each(['motorista', 'ajudante'] as const)('disponibilidade de %s', (tipo) => {
  const pessoa: Colaborador = { id: '1', codigo: '10', nome: 'Pessoa', tipo, sala: null, ativo: true, status: 'Férias' }

  it.each(['Ativo', ' ATIVA ', 'Disponível', 'Disponivel', ''])('libera o retorno com status %s', (status) => {
    expect(colaboradorDisponivel(pessoa)).toBe(false)
    expect(colaboradorDisponivel({ ...pessoa, status })).toBe(true)
  })

  it.each(['Férias', 'INSS', 'Atestado', 'Treinamento', 'Afastado', 'Inativo', 'Indisponível'])('mantém %s fora da lista', (status) => {
    expect(colaboradorDisponivel({ ...pessoa, status })).toBe(false)
  })

  it('não libera cadastro desativado', () => {
    expect(colaboradorDisponivel({ ...pessoa, ativo: false, status: 'Ativo' })).toBe(false)
  })
})
