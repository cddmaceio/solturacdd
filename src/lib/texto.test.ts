import { describe, expect, it } from 'vitest'
import { brNum, code } from './texto'

describe('brNum', () => {
  it('não multiplica números já convertidos (26.26 não vira 2626)', () => {
    expect(brNum(26.26)).toBe(26.26)
    expect(brNum(89.988)).toBe(89.988)
    expect(brNum(94.22)).toBe(94.22)
    expect(brNum(0)).toBe(0)
    expect(brNum(Number.NaN)).toBe(0)
  })

  it('interpreta texto no padrão brasileiro', () => {
    expect(brNum('26,26')).toBe(26.26)
    expect(brNum('26,26 ')).toBe(26.26)
    expect(brNum('1.234,5')).toBe(1234.5)
    expect(brNum('2.894')).toBe(2894)
  })

  it('retorna 0 para vazio e inválido', () => {
    expect(brNum(null)).toBe(0)
    expect(brNum(undefined)).toBe(0)
    expect(brNum('')).toBe(0)
    expect(brNum('abc')).toBe(0)
  })
})

describe('code', () => {
  it('normaliza códigos numéricos com zeros à esquerda', () => {
    expect(code('000000000034')).toBe('34')
    expect(code('34.0')).toBe('34')
    expect(code('ABC')).toBe('ABC')
  })
})
