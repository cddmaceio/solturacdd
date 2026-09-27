import { describe, expect, it } from 'vitest'
import {
  compararVeiculos,
  fidelidade,
  montarEscala,
  normalizarAlocacoes,
  paraLinhasPersistencia,
  type VeiculoEscala,
} from './montagem'
import type { Colaborador, EquipeComPessoas, EscalaLinha, PcdMapa, Veiculo } from '@/types/dominio'

const DATA = '2026-09-26'

function pessoa(codigo: string, tipo: 'motorista' | 'ajudante', nome = `Pessoa ${codigo}`, sala: string | null = null): Colaborador {
  return { id: `id-${tipo}-${codigo}`, codigo, nome, tipo, sala, status: 'Disponivel', ativo: true }
}

function equipe(codigoMotorista: string, codigoAjudante: string): EquipeComPessoas {
  return {
    id: `equipe-${codigoMotorista}-${codigoAjudante}`,
    motorista_id: `id-motorista-${codigoMotorista}`,
    ajudante_id: `id-ajudante-${codigoAjudante}`,
    motorista: pessoa(codigoMotorista, 'motorista'),
    ajudante: pessoa(codigoAjudante, 'ajudante'),
  }
}

function veiculo(placa: string, extra: Partial<Veiculo> = {}): Veiculo {
  return {
    id: `id-${placa}`,
    placa,
    tipo_veiculo: 'TRUCK',
    frota: 'F1',
    disponibilidade: 'DISPONIVEL',
    territorio: null,
    motorista_fixo_codigo: null,
    motorista_fixo_nome: null,
    ativo: true,
    ...extra,
  }
}

function mapa(placa: string, extra: Partial<PcdMapa> = {}): PcdMapa {
  return {
    id: `mapa-${placa}-${extra.mapa ?? 'M1'}`,
    data_entrega: DATA,
    mapa: extra.mapa ?? 'M1',
    roadshow: null,
    transportadora: '10',
    as_rota: null,
    armazem: null,
    tipo_veiculo: 'TRUCK',
    placa,
    veiculo_substituto: null,
    motorista_codigo: null,
    carga: null,
    mpd: 'GERADO',
    hora_mpd: null,
    classificacao: null,
    km_previsto: 100,
    tempo_previsto: '06:00',
    entregas: 10,
    total_caixas: null,
    ocupacao_caixas_pct: null,
    total_peso: 50,
    ocupacao_peso_pct: 50,
    eficiencia_pct: null,
    carga_atual: null,
    cidades: null,
    regiao: null,
    clientes: null,
    ...extra,
  }
}

function montar(opcoes: {
  veiculos?: Veiculo[]
  mapas?: PcdMapa[]
  pessoas?: Colaborador[]
  equipes?: EquipeComPessoas[]
  salvas?: EscalaLinha[]
}) {
  return montarEscala({
    dataIso: DATA,
    veiculos: opcoes.veiculos ?? [],
    mapas: opcoes.mapas ?? [],
    pessoas: opcoes.pessoas ?? [],
    equipes: opcoes.equipes ?? [],
    salvas: opcoes.salvas ?? [],
  })
}

function porPlaca(veiculos: VeiculoEscala[], placa: string): VeiculoEscala {
  const v = veiculos.find((x) => x.chave === placa)
  if (!v) throw new Error(`veículo ${placa} não encontrado`)
  return v
}

describe('montarEscala', () => {
  it('escala a dupla fixa quando as pessoas estão na Base Equipes', () => {
    const veiculos = montar({
      veiculos: [
        veiculo('ABC1D23', {
          motorista_fixo_codigo: '10',
          motorista_fixo_nome: 'JOAO',
        }),
      ],
      mapas: [mapa('ABC1D23')],
      pessoas: [pessoa('10', 'motorista', 'JOAO', 'ELITE'), pessoa('20', 'ajudante')],
      equipes: [equipe('10', '20')],
    })
    const v = porPlaca(veiculos, 'ABC1D23')
    expect(v.motorista_codigo).toBe('10')
    expect(v.ajudante_codigo).toBe('20')
    expect(v.grupo).toBe('ELITE')
  })

  it('não escala motorista fora da Base Equipes nem PARADO nem 800', () => {
    const veiculos = montar({
      veiculos: [
        veiculo('AAA1A11', { motorista_fixo_codigo: '99', motorista_fixo_nome: 'FORA' }),
        veiculo('BBB1B22', { motorista_fixo_codigo: '98', motorista_fixo_nome: 'PARADO' }),
        veiculo('CCC1C33', { motorista_fixo_codigo: '800' }),
      ],
      mapas: [mapa('AAA1A11'), mapa('BBB1B22'), mapa('CCC1C33')],
      pessoas: [pessoa('99', 'motorista')],
    })
    expect(porPlaca(veiculos, 'AAA1A11').motorista_codigo).toBe('99')
    expect(porPlaca(veiculos, 'BBB1B22').motorista_codigo).toBe('')
    expect(porPlaca(veiculos, 'CCC1C33').motorista_codigo).toBe('')
  })

  it('mantém ajudante fixo 800/801 mesmo fora da Base Equipes', () => {
    const veiculos = montar({
      veiculos: [
          veiculo('DDD1D44', { motorista_fixo_codigo: '10' }),
          veiculo('EEE1E55', { motorista_fixo_codigo: '11' }),
      ],
      mapas: [mapa('DDD1D44'), mapa('EEE1E55')],
      pessoas: [pessoa('10', 'motorista'), pessoa('11', 'motorista')],
      equipes: [equipe('10', '800'), equipe('11', '801')],
    })
    expect(porPlaca(veiculos, 'DDD1D44').ajudante_codigo).toBe('800')
    expect(porPlaca(veiculos, 'EEE1E55').ajudante_codigo).toBe('801')
  })

  it('aplica pernoite: motorista do mapa pendente anterior substitui a dupla fixa', () => {
    const veiculos = montar({
      veiculos: [
        veiculo('FFF1F66', {
          motorista_fixo_codigo: '10',
          motorista_fixo_nome: 'JOAO',
        }),
      ],
      mapas: [
        mapa('FFF1F66'),
        mapa('FFF1F66', {
          mapa: 'M0',
          data_entrega: '2026-09-25',
          mpd: 'EMITIDO',
          motorista_codigo: '77',
        }),
      ],
      pessoas: [pessoa('10', 'motorista'), pessoa('20', 'ajudante'), pessoa('77', 'motorista')],
      equipes: [equipe('10', '20')],
    })
    const v = porPlaca(veiculos, 'FFF1F66')
    expect(v.motorista_codigo).toBe('77')
    expect(v.ajudante_codigo).toBe('')
  })

  it('ignora mapa pendente de MPD fechado (pernoite não vale)', () => {
    const veiculos = montar({
      veiculos: [
        veiculo('GGG1G77', {
          motorista_fixo_codigo: '10',
          motorista_fixo_nome: 'JOAO',
        }),
      ],
      mapas: [
        mapa('GGG1G77'),
        mapa('GGG1G77', {
          mapa: 'M0',
          data_entrega: '2026-09-25',
          mpd: 'PC FINANCEIRA',
          motorista_codigo: '77',
        }),
      ],
      pessoas: [pessoa('10', 'motorista')],
    })
    expect(porPlaca(veiculos, 'GGG1G77').motorista_codigo).toBe('10')
  })

  it('libera a equipe de veículo sem mapa D0 e sem pendência', () => {
    const veiculos = montar({
      veiculos: [
        veiculo('HHH1H88', {
          motorista_fixo_codigo: '10',
          motorista_fixo_nome: 'JOAO',
        }),
      ],
      mapas: [],
      pessoas: [pessoa('10', 'motorista'), pessoa('20', 'ajudante')],
      equipes: [equipe('10', '20')],
    })
    const v = porPlaca(veiculos, 'HHH1H88')
    expect(v.motorista_codigo).toBe('')
    expect(v.ajudante_codigo).toBe('')
  })

  it('exclui freteiro e placas genéricas das rotas da escala', () => {
    const veiculos = montar({
      veiculos: [veiculo('III1I99')],
      mapas: [
        mapa('III1I99', { carga: 'FRETEIRO' }),
        mapa('REC123', { mapa: 'M9' }),
        mapa('SPOT'),
      ],
      pessoas: [],
    })
    expect(porPlaca(veiculos, 'III1I99').rotas).toHaveLength(0)
    expect(veiculos.some((v) => v.placa === 'REC123')).toBe(false)
    expect(veiculos.some((v) => v.placa === 'SPOT')).toBe(false)
  })

  it('exclui mapas Zumpy da escala mesmo quando a placa consta na frota fixa', () => {
    const veiculos = montar({
      veiculos: [veiculo('ABC1D23')],
      mapas: [mapa('ABC1D23', { transportadora: '54' })],
    })
    expect(porPlaca(veiculos, 'ABC1D23').rotas).toHaveLength(0)
  })

  it('resolve conflito: pessoa em dois veículos fica só no de maior prioridade (D0)', () => {
    const veiculos = montar({
      veiculos: [veiculo('JJJ1J10'), veiculo('KKK1K20')],
      mapas: [
        mapa('JJJ1J10'),
        mapa('KKK1K20', { mapa: 'M0', data_entrega: '2026-09-25', mpd: 'EMITIDO' }),
      ],
      pessoas: [pessoa('50', 'motorista')],
      salvas: [
        linha('JJJ1J10', '50', ''),
        linha('KKK1K20', '50', ''),
      ],
    })
    expect(porPlaca(veiculos, 'JJJ1J10').motorista_codigo).toBe('50')
    expect(porPlaca(veiculos, 'KKK1K20').motorista_codigo).toBe('')
  })

  it('preserva ajustes salvos (grupo, observação e equipe)', () => {
    const veiculos = montar({
      veiculos: [veiculo('LLL1L30')],
      mapas: [mapa('LLL1L30')],
      pessoas: [pessoa('10', 'motorista'), pessoa('60', 'ajudante')],
      salvas: [{ ...linha('LLL1L30', '10', '60'), sala: 'VANS', observacao: 'troca manual' }],
    })
    const v = porPlaca(veiculos, 'LLL1L30')
    expect(v.grupo).toBe('VANS')
    expect(v.observacao).toBe('troca manual')
    expect(v.motorista_codigo).toBe('10')
    expect(v.ajudante_codigo).toBe('60')
  })

  it('restaura Ajudante 2 e o Chapa/PX dos slots salvos', () => {
    const veiculos = montar({
      veiculos: [veiculo('LAA1L30')],
      mapas: [mapa('LAA1L30')],
      pessoas: [pessoa('62', 'ajudante')],
      salvas: [{
        ...linha('LAA1L30', '', ''),
        ajudante2_codigo: '62',
        ajudante2_nome: 'MARIA 2',
        ajudante2_manual: true,
        chapa_codigo: '',
        chapa_nome: 'PAULO PX',
        chapa_manual: true,
      }],
    })
    const v = porPlaca(veiculos, 'LAA1L30')
    expect(v.ajudante2_codigo).toBe('62')
    expect(v.chapa_codigo).toBe('')
    expect(v.chapa_nome).toBe('PAULO PX')
  })

  it('ordena por tipo de veículo (VAN → VULCK → TRUCK → SIDER → SPOT)', () => {
    const veiculos = montar({
      veiculos: [
        veiculo('SID1S11', { tipo_veiculo: 'SIDER' }),
        veiculo('VAN1V22', { tipo_veiculo: 'VAN' }),
        veiculo('TRU1T33', { tipo_veiculo: 'TRUCK' }),
      ],
      mapas: [mapa('SID1S11'), mapa('VAN1V22'), mapa('TRU1T33')],
    })
    expect(veiculos.map((v) => v.placa)).toEqual(['VAN1V22', 'TRU1T33', 'SID1S11'])
  })

  it('preenche slot vazio congelado com a equipe fixa quando há mapa', () => {
    const veiculos = montar({
      veiculos: [
        veiculo('MMM1M11', {
          motorista_fixo_codigo: '10',
          motorista_fixo_nome: 'JOAO',
        }),
      ],
      mapas: [mapa('MMM1M11')],
      pessoas: [pessoa('10', 'motorista'), pessoa('20', 'ajudante')],
      equipes: [equipe('10', '20')],
      salvas: [linha('MMM1M11', '', '')],
    })
    const v = porPlaca(veiculos, 'MMM1M11')
    expect(v.motorista_codigo).toBe('10')
    expect(v.ajudante_codigo).toBe('20')
  })

  it('mantém vazio slot limpo manualmente mesmo com equipe fixa', () => {
    const veiculos = montar({
      veiculos: [
        veiculo('NNN1N12', {
          motorista_fixo_codigo: '10',
          motorista_fixo_nome: 'JOAO',
        }),
      ],
      mapas: [mapa('NNN1N12')],
      pessoas: [pessoa('10', 'motorista'), pessoa('20', 'ajudante')],
      equipes: [equipe('10', '20')],
      salvas: [{ ...linha('NNN1N12', '', ''), motorista_manual: true, ajudante_manual: true }],
    })
    const v = porPlaca(veiculos, 'NNN1N12')
    expect(v.motorista_codigo).toBe('')
    expect(v.ajudante_codigo).toBe('')
  })

  it('mantém a escolha manual em vez do fixo quando o slot não está vazio', () => {
    const veiculos = montar({
      veiculos: [
        veiculo('PPP1P14', {
          motorista_fixo_codigo: '10',
          motorista_fixo_nome: 'JOAO',
        }),
      ],
      mapas: [mapa('PPP1P14')],
      pessoas: [pessoa('10', 'motorista'), pessoa('20', 'ajudante'), pessoa('77', 'motorista')],
      equipes: [equipe('10', '20')],
      salvas: [{ ...linha('PPP1P14', '77', ''), motorista_manual: true }],
    })
    const v = porPlaca(veiculos, 'PPP1P14')
    expect(v.motorista_codigo).toBe('77')
  })

  it('aplica pernoite sobre slot vazio congelado sem marca manual', () => {
    const veiculos = montar({
      veiculos: [
        veiculo('OOO1O13', {
          motorista_fixo_codigo: '10',
          motorista_fixo_nome: 'JOAO',
        }),
      ],
      mapas: [
        mapa('OOO1O13'),
        mapa('OOO1O13', {
          mapa: 'M0',
          data_entrega: '2026-09-25',
          mpd: 'EMITIDO',
          motorista_codigo: '77',
        }),
      ],
      pessoas: [pessoa('10', 'motorista'), pessoa('20', 'ajudante'), pessoa('77', 'motorista')],
      equipes: [equipe('10', '20')],
      salvas: [linha('OOO1O13', '', '')],
    })
    const v = porPlaca(veiculos, 'OOO1O13')
    expect(v.motorista_codigo).toBe('77')
  })

  it('não deixa o pernoite reocupar slot limpo manualmente', () => {
    const veiculos = montar({
      veiculos: [
        veiculo('QQQ1Q15', {
          motorista_fixo_codigo: '10',
          motorista_fixo_nome: 'JOAO',
        }),
      ],
      mapas: [
        mapa('QQQ1Q15'),
        mapa('QQQ1Q15', {
          mapa: 'M0',
          data_entrega: '2026-09-25',
          mpd: 'EMITIDO',
          motorista_codigo: '77',
        }),
      ],
      pessoas: [pessoa('10', 'motorista'), pessoa('20', 'ajudante'), pessoa('77', 'motorista')],
      equipes: [equipe('10', '20')],
      salvas: [{ ...linha('QQQ1Q15', '', ''), motorista_manual: true }],
    })
    const v = porPlaca(veiculos, 'QQQ1Q15')
    expect(v.motorista_codigo).toBe('')
  })
})

describe('fidelidade', () => {
  const base = veiculo('ABC1D23', { motorista_fixo_codigo: '10', motorista_fixo_nome: 'JOAO' })

  it('retorna ok/no/na conforme a referência', () => {
    const comFixo: VeiculoEscala = {
      chave: 'ABC1D23',
      placa: 'ABC1D23',
      isSpot: false,
      base,
      rotas: [mapa('ABC1D23')],
      carregado: true,
      temD1: false,
      motorista_codigo: '10',
      ajudante_codigo: '',
      ajudante2_codigo: '',
      ajudante_referencia: '20',
      chapa_codigo: '',
      chapa_nome: '',
      grupo: 'ELITE',
      observacao: '',
    }
    expect(fidelidade(comFixo, 'motorista')).toBe('ok')
    expect({ ...comFixo, motorista_codigo: '77' }).toHaveProperty('motorista_codigo', '77')
    expect(fidelidade({ ...comFixo, motorista_codigo: '77' }, 'motorista')).toBe('no')
    expect(fidelidade({ ...comFixo, motorista_codigo: '' }, 'motorista')).toBe('no')
    expect(
      fidelidade({ ...comFixo, base: veiculo('X', { motorista_fixo_codigo: '10', motorista_fixo_nome: 'PARADO' }) }, 'motorista'),
    ).toBe('na')
    expect(fidelidade({ ...comFixo, ajudante_referencia: '20', ajudante_codigo: '20' }, 'ajudante')).toBe('ok')
    expect(fidelidade({ ...comFixo, ajudante_referencia: '20', ajudante_codigo: '30' }, 'ajudante')).toBe('no')
  })
})

describe('normalizarAlocacoes', () => {
  it('limpa slots de veículo sem rotas e deduplica pessoas', () => {
    const semMapa: VeiculoEscala = {
      chave: 'AAA',
      placa: 'AAA',
      isSpot: false,
      base: veiculo('AAA'),
      rotas: [],
      carregado: false,
      temD1: false,
      motorista_codigo: '10',
      ajudante_codigo: '20',
      ajudante2_codigo: '',
      ajudante_referencia: '',
      chapa_codigo: '',
      chapa_nome: '',
      grupo: 'ELITE',
      observacao: '',
    }
    const comMapa: VeiculoEscala = { ...semMapa, chave: 'BBB', placa: 'BBB', rotas: [mapa('BBB')] }
    const comMapa2: VeiculoEscala = {
      ...semMapa,
      chave: 'CCC',
      placa: 'CCC',
      rotas: [mapa('CCC', { data_entrega: '2026-09-25' })],
    }
    comMapa.motorista_codigo = '10'
    comMapa2.motorista_codigo = '10'
    normalizarAlocacoes([semMapa, comMapa, comMapa2], DATA)
    expect(semMapa.motorista_codigo).toBe('')
    expect(comMapa.motorista_codigo).toBe('10')
    expect(comMapa2.motorista_codigo).toBe('')
  })

  it('deduplica o mesmo ajudante entre Ajudante 1 e Ajudante 2', () => {
    const d0: VeiculoEscala = {
      chave: 'D0', placa: 'D0', isSpot: false, base: veiculo('D0'), rotas: [mapa('D0')],
      carregado: true, temD1: false, motorista_codigo: '', ajudante_codigo: '',
      ajudante2_codigo: '20', ajudante_referencia: '', chapa_codigo: '', chapa_nome: '',
      grupo: 'ELITE', observacao: '',
    }
    const pendente: VeiculoEscala = {
      chave: 'D1', placa: 'D1', isSpot: false, base: veiculo('D1'),
      rotas: [mapa('D1', { data_entrega: '2026-09-25' })], carregado: true, temD1: true,
      motorista_codigo: '', ajudante_codigo: '20', ajudante2_codigo: '', ajudante_referencia: '',
      chapa_codigo: '', chapa_nome: '', grupo: 'ELITE', observacao: '',
    }
    normalizarAlocacoes([pendente, d0], DATA)
    expect(d0.ajudante2_codigo).toBe('20')
    expect(pendente.ajudante_codigo).toBe('')
  })
})

describe('paraLinhasPersistencia', () => {
  it('gera linhas com snapshot de nomes', () => {
    const v: VeiculoEscala = {
      chave: 'ABC1D23',
      placa: 'ABC1D23',
      isSpot: false,
      base: veiculo('ABC1D23'),
      rotas: [mapa('ABC1D23')],
      carregado: true,
      temD1: false,
      motorista_codigo: '10',
      ajudante_codigo: '20',
      ajudante2_codigo: '30',
      ajudante_referencia: '',
      chapa_codigo: 'PX7',
      chapa_nome: 'PEDRO PX',
      grupo: 'ELITE',
      observacao: 'obs',
    }
    const linhas = paraLinhasPersistencia([v], DATA, [
      pessoa('10', 'motorista', 'JOAO SILVA'),
      pessoa('20', 'ajudante', 'MARIA SOUZA'),
      pessoa('30', 'ajudante', 'MARIA 2'),
    ])
    expect(linhas[0]).toMatchObject({
      data_operacao: DATA,
      veiculo_placa: 'ABC1D23',
      motorista_codigo: '10',
      motorista_nome: 'JOAO SILVA',
      motorista_manual: false,
      ajudante_codigo: '20',
      ajudante_nome: 'MARIA SOUZA',
      ajudante_manual: false,
      ajudante2_codigo: '30',
      ajudante2_nome: 'MARIA 2',
      ajudante2_manual: false,
      chapa_codigo: 'PX7',
      chapa_nome: 'PEDRO PX',
      chapa_manual: false,
      sala: 'ELITE',
      observacao: 'obs',
    })
  })
})

describe('compararVeiculos', () => {
  it('ordena SPOT por último', () => {
    const mk = (placa: string, isSpot = false): VeiculoEscala => ({
      chave: placa,
      placa,
      isSpot,
      base: veiculo(placa),
      rotas: [],
      carregado: false,
      temD1: false,
      motorista_codigo: '',
      ajudante_codigo: '',
      ajudante2_codigo: '',
      ajudante_referencia: '',
      chapa_codigo: '',
      chapa_nome: '',
      grupo: '',
      observacao: '',
    })
    const lista = [mk('ZZZ1Z99', true), mk('AAA1A11'), mk('BBB1B22')]
    lista.sort(compararVeiculos)
    expect(lista.map((v) => v.placa)).toEqual(['AAA1A11', 'BBB1B22', 'ZZZ1Z99'])
  })
})

function linha(placa: string, motorista: string, ajudante: string): EscalaLinha {
  return {
    id: `id-${placa}`,
    data_operacao: DATA,
    veiculo_placa: placa,
    motorista_codigo: motorista,
    motorista_nome: '',
    ajudante_codigo: ajudante,
    ajudante_nome: '',
    ajudante2_codigo: '',
    ajudante2_nome: '',
    chapa_codigo: '',
    chapa_nome: '',
    sala: '',
    observacao: '',
  }
}
