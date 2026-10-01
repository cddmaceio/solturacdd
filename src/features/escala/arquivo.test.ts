import { describe, expect, it } from 'vitest'
import { destaqueLinha, montarEscala, paraLinhasPersistencia } from './montagem'
import type { Colaborador, Entrada } from './fixtures-arquivo'
import { entrada, mapa, salvar } from './fixtures-arquivo'

describe('arquivo diário da escala', () => {
  it('retira pendência fechada de hoje sem alterar a equipe manual ou o histórico', () => {
    const inicial = entrada()
    const salvas = salvar(inicial).map((s) => ({ ...s, motorista_codigo: '99', motorista_manual: true }))
    const atualizado = { ...inicial, salvas, mapas: [{ ...inicial.mapas[0], id: 'reimportado', mpd: 'pc financeira' }] }
    const [hoje] = montarEscala(atualizado)
    expect(hoje.rotas).toEqual([])
    expect(hoje.temD1).toBe(false)
    expect(hoje.carregado).toBe(false)
    expect(hoje.motorista_codigo).toBe('99')
    const [historico] = montarEscala({ ...atualizado, hojeIso: '2026-09-29' })
    expect(historico.rotas).toEqual(inicial.mapas)
  })

  it('preserva Nelson e o mapa de sábado após fechar, reimportar e remover os cadastros', () => {
    const inicial = entrada()
    const salvas = salvar(inicial)
    const [v] = montarEscala({ ...inicial, hojeIso: '2026-09-29', salvas, veiculos: [], pessoas: [], equipes: [],
      mapas: [{ ...inicial.mapas[0], id: 'novo-id', mpd: 'PC financeira' }] })
    expect(v.motorista_codigo).toBe('296')
    expect(v.rotas).toEqual(inicial.mapas)
    expect(v.carregado).toBe(true)
    expect(v.temD1).toBe(true)
    expect(v.base?.placa).toBe('UHJ6F39')
    const [diaSeguinte] = montarEscala({ ...inicial, dataIso: '2026-09-29', hojeIso: '2026-09-29',
      mapas: [{ ...inicial.mapas[0], mpd: 'PC financeira' }] })
    expect(diaSeguinte.rotas).toHaveLength(0)
    expect(diaSeguinte.motorista_codigo).toBe('')
  })

  it('adiciona novos mapas sem duplicar UUIDs reimportados nem substituir ajustes', () => {
    const inicial = entrada()
    const salvas = salvar(inicial).map((s) => ({ ...s, motorista_codigo: '99', motorista_manual: true,
      ajudante_codigo: '', ajudante_manual: true, sala: 'VESPERTINA', observacao: 'Ajuste supervisor' }))
    const [v] = montarEscala({ ...inicial, salvas, mapas: [
      { ...inicial.mapas[0], id: 'novo-id', mpd: 'PC financeira' }, mapa('NOVO', '2026-09-28'),
    ] })
    expect(v.rotas).toHaveLength(1)
    expect(v.rotas[0].mapa).toBe('NOVO')
    expect(v.motorista_codigo).toBe('99')
    expect(v.ajudante_codigo).toBe('')
    expect(v.grupo).toBe('VESPERTINA')
    expect(v.observacao).toBe('Ajuste supervisor')
  })

  it('não acrescenta mapas nem veículos ao consultar data passada', () => {
    const inicial = entrada()
    const salvas = salvar(inicial)
    const [v] = montarEscala({ ...inicial, hojeIso: '2026-09-29', salvas, mapas: [mapa('NOVO', '2026-09-28')] })
    expect(v.rotas.map((m) => m.mapa)).toEqual(['574742'])
    expect(montarEscala({ ...inicial, hojeIso: '2026-09-29' })).toEqual([])
  })

  it('pernoite que chega depois da escala usa o motorista PCD e libera a dupla fixa', () => {
    const inicial = entrada()
    const salvas = salvar({ ...inicial, mapas: [mapa('D0', '2026-09-28')] })
    expect(salvas[0].motorista_codigo).toBe('10')
    expect(salvas[0].ajudante_codigo).toBe('20')
    const [v] = montarEscala({ ...inicial, salvas, mapas: [...inicial.mapas, mapa('D0', '2026-09-28')] })
    expect(v.motorista_codigo).toBe('296')
    expect(v.ajudante_codigo).toBe('')
    expect([v.motorista_codigo, v.ajudante_codigo]).not.toContain('10')
    expect([v.motorista_codigo, v.ajudante_codigo]).not.toContain('20')
  })

  it('pernoite novo respeita motorista e ajudante escolhidos manualmente', () => {
    const inicial = entrada()
    const salvas = salvar({ ...inicial, mapas: [] }).map((s) => ({ ...s,
      motorista_codigo: '99', motorista_manual: true, ajudante_codigo: '3', ajudante_manual: true }))
    const [v] = montarEscala({ ...inicial, salvas })
    expect(v.motorista_codigo).toBe('99')
    expect(v.ajudante_codigo).toBe('3')
  })

  it('inicializa primeira carga, mas não preenche vazios de um arquivo já carregado', () => {
    const inicial = entrada()
    const vazia = salvar({ ...inicial, mapas: [] })
    const [primeira] = montarEscala({ ...inicial, salvas: vazia })
    expect(primeira.motorista_codigo).toBe('296')
    const salvas = salvar(inicial).map((s) => ({ ...s, motorista_codigo: '', motorista_manual: false }))
    expect(montarEscala({ ...inicial, salvas })[0].motorista_codigo).toBe('')
  })

  it('novo veículo não toma a pessoa de uma alocação salva', () => {
    const inicial = entrada()
    const salvas = salvar(inicial)
    const novos: Entrada = { ...inicial, salvas,
      veiculos: [...inicial.veiculos, { ...inicial.veiculos[0], placa: 'AAA1A11', motorista_fixo_codigo: '296' }],
      mapas: [...inicial.mapas, { ...mapa('D0', '2026-09-28'), placa: 'AAA1A11' }] }
    const resultado = montarEscala(novos)
    expect(resultado.find((v) => v.placa === 'UHJ6F39')?.motorista_codigo).toBe('296')
    expect(resultado.find((v) => v.placa === 'AAA1A11')?.motorista_codigo).toBe('')
  })

  it('motorista do pernoite sai de outra alocação automática, mas não de escolha manual', () => {
    const inicial = entrada()
    const outro = { ...inicial.veiculos[0], placa: 'ZZZ1Z11', motorista_fixo_codigo: '296' }
    const d0 = { ...mapa('OUTRO', '2026-09-28'), placa: outro.placa }
    const antes = { ...inicial, veiculos: [...inicial.veiculos, outro], mapas: [d0] }
    const salvas = salvar(antes)
    const depois = montarEscala({ ...antes, salvas, mapas: [d0, ...inicial.mapas] })
    expect(depois.find((v) => v.placa === 'UHJ6F39')?.motorista_codigo).toBe('296')
    expect(depois.find((v) => v.placa === outro.placa)?.motorista_codigo).toBe('')
    const manual = salvas.map((s) => ({ ...s, motorista_manual: s.veiculo_placa === outro.placa }))
    const protegido = montarEscala({ ...antes, salvas: manual, mapas: [d0, ...inicial.mapas] })
    expect(protegido.find((v) => v.placa === outro.placa)?.motorista_codigo).toBe('296')
    expect(protegido.find((v) => v.placa === 'UHJ6F39')?.motorista_codigo).toBe('')
  })

  it('salva cópias independentes do cadastro e classificação', () => {
    const inicial = entrada()
    const salvas = salvar(inicial)
    const pessoas: Colaborador[] = inicial.pessoas.map((p) => ({ ...p, nome: 'NOVO NOME' }))
    const [v] = montarEscala({ ...inicial, pessoas, salvas,
      veiculos: inicial.veiculos.map((v) => ({ ...v, tipo_veiculo: 'VAN' })) })
    expect(v.base?.tipo_veiculo).toBe('TRUCK')
    expect(salvas[0].motorista_nome).toBe('NELSON')
    expect(paraLinhasPersistencia([v], inicial.dataIso, pessoas)[0].snapshot?.rotas).toEqual(inicial.mapas)
  })

  it.each([
    ['2026-09-26', 'Noturna Gradativa', 'pernoite'],
    ['2026-09-28', 'Rota Gradativa', 'gradativa'],
    ['2026-09-28', 'Noturna', 'noturna'],
    ['2026-09-28', 'Noturno', 'noturna'],
    ['2026-09-28', 'Padrao', ''],
  ])('destaca %s / %s como %s', (data, classificacao, esperado) => {
    const inicial = entrada()
    const [v] = montarEscala({ ...inicial, mapas: [{ ...mapa('M', data), classificacao }] })
    expect(destaqueLinha(v, inicial.dataIso)).toBe(esperado)
  })
})
