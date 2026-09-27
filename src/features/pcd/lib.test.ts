import { describe, expect, it } from 'vitest'
import { classeClassificacao, ehZumpy, rotuloClassificacao } from './lib'

describe('classificacao do mapa', () => {
  it('pinta Noturno de cinza claro', () => {
    expect(classeClassificacao('Noturno')).toBe('border-slate-200 bg-slate-100 text-slate-600')
    expect(classeClassificacao('Noturna')).toBe('border-slate-200 bg-slate-100 text-slate-600')
  })

  it('pinta Rota Gradativa de laranja', () => {
    expect(classeClassificacao('Rota Gradativa ')).toBe(
      'border-orange-200 bg-orange-50 text-orange-700',
    )
  })

  it('pinta Recarga de ciano', () => {
    expect(classeClassificacao('Recarga')).toBe('border-cyan-200 bg-cyan-50 text-cyan-700')
  })

  it('pinta Padrão/outras de azul claro', () => {
    expect(classeClassificacao('Padrao')).toBe('border-sky-200 bg-sky-50 text-sky-700')
    expect(classeClassificacao('')).toBe('border-border bg-muted text-muted-foreground')
    expect(classeClassificacao(null)).toBe('border-border bg-muted text-muted-foreground')
  })

  it('remove espaços do rótulo exibido', () => {
    expect(rotuloClassificacao(' Rota Gradativa ')).toBe('Rota Gradativa')
    expect(rotuloClassificacao(null)).toBe('')
  })
})

describe('transportadora Zumpy', () => {
  it('identifica a transportadora 54', () => {
    expect(ehZumpy({ transportadora: '54' })).toBe(true)
    expect(ehZumpy({ transportadora: '10' })).toBe(false)
    expect(ehZumpy({ transportadora: null })).toBe(false)
  })
})
