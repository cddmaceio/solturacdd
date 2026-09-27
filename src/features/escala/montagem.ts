import { brNum, code, norm } from '@/lib/texto'
import { mapaAberto, ehFreteiro, ehPlacaGenerica, ehZumpy } from '@/features/pcd/lib'
import type { Colaborador, EquipeComPessoas, EscalaLinha, PcdMapa, PapelEquipe, Veiculo } from '@/types/dominio'

export type VeiculoEscala = {
  chave: string
  placa: string
  isSpot: boolean
  base: Veiculo | null
  rotas: PcdMapa[]
  carregado: boolean
  temD1: boolean
  motorista_codigo: string
  ajudante_codigo: string
  ajudante_referencia: string
  grupo: string
  observacao: string
}

export type EntradaMontagem = {
  dataIso: string
  veiculos: Veiculo[]
  mapas: PcdMapa[]
  pessoas: Colaborador[]
  equipes: EquipeComPessoas[]
  salvas: EscalaLinha[]
}

// ---------------------------------------------------------------------------
// Auxiliares puros
// ---------------------------------------------------------------------------

export function tipoVeiculoNormalizado(valor: string | null | undefined): string {
  const n = norm(valor)
  if (n.includes('VAN')) return 'VAN'
  if (n.includes('VULCK') || n === 'VUC' || n.includes('VUC ') || n.startsWith('VUC') || n.includes('VLC'))
    return 'VULCK'
  if (n.includes('TRUCK')) return 'TRUCK'
  if (n.includes('SIDER')) return 'SIDER'
  return String(valor || '').trim().toUpperCase() || 'OUTRO'
}

export function rotuloTipoVeiculo(v: VeiculoEscala): string {
  if (v.isSpot) return 'SPOT'
  return tipoVeiculoNormalizado(v.base?.tipo_veiculo)
}

function rankTipoVeiculo(v: VeiculoEscala): number {
  if (v.isSpot) return 99
  const t = tipoVeiculoNormalizado(v.base?.tipo_veiculo)
  return t === 'VAN' ? 0 : t === 'VULCK' ? 1 : t === 'TRUCK' ? 2 : t === 'SIDER' ? 3 : 4
}

export function compararVeiculos(a: VeiculoEscala, b: VeiculoEscala): number {
  const d = rankTipoVeiculo(a) - rankTipoVeiculo(b)
  if (d) return d
  const ta = rotuloTipoVeiculo(a)
  const tb = rotuloTipoVeiculo(b)
  return (
    ta.localeCompare(tb, 'pt-BR') ||
    a.placa.localeCompare(b.placa, 'pt-BR', { numeric: true })
  )
}

export function salaDoMotorista(codigo: string, pessoas: Colaborador[]): string {
  const motorista = pessoas.find((p) => p.tipo === 'motorista' && code(p.codigo) === code(codigo))
  const r = String(motorista?.sala ?? '').trim()
  return r ? r.toUpperCase() : 'OUTROS'
}

export function opcoesSala(pessoas: Colaborador[], salvas: EscalaLinha[] = []): string[] {
  const cru = new Set([
    ...pessoas.map((p) => String(p.sala ?? '').trim()).filter(Boolean),
    ...salvas.map((s) => String(s.sala ?? '').trim()).filter(Boolean),
  ])
  const preferidas = ['ELITE', 'FORÇA', 'VANS', 'VESPERTINA', 'AS', 'SPOT', 'OUTROS']
  const normalizadas = new Map([...cru].map((x) => [norm(x), x.toUpperCase()]))
  const saida: string[] = []
  for (const p of preferidas) {
    if (normalizadas.has(norm(p))) {
      saida.push(normalizadas.get(norm(p))!)
      normalizadas.delete(norm(p))
    }
  }
  for (const x of [...normalizadas.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
    saida.push(x)
  }
  for (const x of ['AS', 'SPOT', 'OUTROS']) if (!saida.includes(x)) saida.push(x)
  return saida
}

export function disponibilidade(v: VeiculoEscala): 'SPOT' | 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN' {
  if (v.isSpot) return 'SPOT'
  const a = norm(v.base?.disponibilidade)
  if (a.includes('INDISP')) return 'UNAVAILABLE'
  if (a.includes('DISPON')) return 'AVAILABLE'
  return 'UNKNOWN'
}

export function minutosTempo(t: string | null | undefined): number {
  const p = String(t ?? '')
    .split(':')
    .map(Number)
  if (!p.length || Number.isNaN(p[0])) return 0
  return (p[0] || 0) * 60 + (p[1] || 0) + (p[2] || 0) / 60
}

export function rotuloTempo(minutos: number): string {
  if (!minutos) return '—'
  let h = Math.floor(minutos / 60)
  let m = Math.round(minutos % 60)
  if (m === 60) {
    h++
    m = 0
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function ehMapaCritico(r: PcdMapa): boolean {
  return brNum(r.ocupacao_peso_pct) > 90 && minutosTempo(r.tempo_previsto) > 9 * 60
}

export type EstatisticasVeiculo = {
  km: number
  entregas: number
  ocupacaoCaixas: number
  ocupacaoPeso: number
  tempoMinutos: number
  tempoRotulo: string
}

export function estatisticasVeiculo(v: VeiculoEscala): EstatisticasVeiculo {
  const km = v.rotas.reduce((s, r) => s + brNum(r.km_previsto), 0)
  const entregas = v.rotas.reduce((s, r) => s + brNum(r.entregas), 0)
  const occs = v.rotas
    .map((r) => brNum(r.ocupacao_caixas_pct))
    .filter((x) => x || String(x) === '0')
  const occWeights = v.rotas
    .map((r) => brNum(r.ocupacao_peso_pct))
    .filter((x) => x || String(x) === '0')
  const tempoMinutos = v.rotas.reduce((s, r) => s + minutosTempo(r.tempo_previsto), 0)
  return {
    km,
    entregas,
    ocupacaoCaixas: occs.length ? occs.reduce((a, b) => a + b, 0) / occs.length : 0,
    ocupacaoPeso: occWeights.length ? occWeights.reduce((a, b) => a + b, 0) / occWeights.length : 0,
    tempoMinutos,
    tempoRotulo: rotuloTempo(tempoMinutos),
  }
}

export type Fidelidade = 'ok' | 'no' | 'na'

export function fidelidade(v: VeiculoEscala, papel: PapelEquipe): Fidelidade {
  const atribuido = code(papel === 'motorista' ? v.motorista_codigo : v.ajudante_codigo)
  const fixo = code(papel === 'motorista' ? v.base?.motorista_fixo_codigo : v.ajudante_referencia)
  if (
    !fixo ||
    fixo === '800' ||
    (papel === 'motorista' && norm(v.base?.motorista_fixo_nome) === 'PARADO')
  ) {
    return 'na'
  }
  if (!atribuido) return 'no'
  return atribuido === fixo ? 'ok' : 'no'
}

/** Motorista do mapa pendente (pernoite): mapa aberto de data anterior mais recente. */
export function mapaPendencia(v: VeiculoEscala, dataIso: string): PcdMapa | null {
  const candidatas = v.rotas
    .filter(
      (r) =>
        r.data_entrega !== dataIso &&
        mapaAberto(r) &&
        code(r.motorista_codigo) &&
        code(r.motorista_codigo) !== '800',
    )
    .sort(
      (a, b) =>
        b.data_entrega.localeCompare(a.data_entrega) ||
        String(b.mapa).localeCompare(String(a.mapa), 'pt-BR', { numeric: true }),
    )
  return candidatas[0] ?? null
}

// ---------------------------------------------------------------------------
// Montagem principal (port fiel de buildVehicles + normalizeOperationalAssignments)
// ---------------------------------------------------------------------------

export function montarEscala(entrada: EntradaMontagem): VeiculoEscala[] {
  const { dataIso, veiculos, mapas, pessoas, equipes, salvas } = entrada

  const disponiveisMotoristas = new Set(
    pessoas.filter((p) => p.tipo === 'motorista').map((p) => code(p.codigo)),
  )
  const disponiveisAjudantes = new Set(
    pessoas.filter((p) => p.tipo === 'ajudante').map((p) => code(p.codigo)),
  )
  const ajudantePorMotorista = new Map<string, string>()
  for (const equipe of equipes) {
    const motorista = code(equipe.motorista?.codigo ?? '')
    const ajudante = code(equipe.ajudante?.codigo ?? '')
    if (motorista && ajudante) ajudantePorMotorista.set(motorista, ajudante)
  }

  // Rotas elegíveis para a escala: D0 + pendências anteriores abertas,
  // placas fixas não genéricas e não freteiro.
  const placasFixas = new Set(veiculos.map((v) => norm(v.placa)).filter(Boolean))
  const rotasElegiveis = mapas.filter(
    (r) =>
      (r.data_entrega === dataIso || ehPendenciaAnterior(r, dataIso)) &&
      !ehPlacaGenerica(r.placa) &&
      !ehFreteiro(r) &&
      !ehZumpy(r) &&
      placasFixas.has(norm(r.placa)),
  )

  const porPlaca = new Map<string, PcdMapa[]>()
  for (const r of rotasElegiveis) {
    const k = norm(r.placa)
    if (!k) continue
    if (!porPlaca.has(k)) porPlaca.set(k, [])
    porPlaca.get(k)!.push(r)
  }
  const ordenarRotas = (rotas: PcdMapa[]) =>
    [...rotas].sort(
      (a, b) =>
        (a.data_entrega === dataIso ? 0 : 1) - (b.data_entrega === dataIso ? 0 : 1) ||
        b.data_entrega.localeCompare(a.data_entrega) ||
        String(a.mapa).localeCompare(String(b.mapa), 'pt-BR', { numeric: true }),
    )

  const resultado: VeiculoEscala[] = []
  const vistas = new Set<string>()

  for (const base of veiculos) {
    const k = norm(base.placa)
    if (!k || vistas.has(k)) continue
    vistas.add(k)
    const rotas = ordenarRotas(porPlaca.get(k) ?? [])
    resultado.push({
      chave: base.placa,
      placa: base.placa,
      isSpot: false,
      base,
      rotas,
      carregado: rotas.length > 0,
      temD1: rotas.some((r) => r.data_entrega !== dataIso),
      motorista_codigo: '',
      ajudante_codigo: '',
      ajudante_referencia: ajudantePorMotorista.get(code(base.motorista_fixo_codigo)) ?? '',
      grupo: salaDoMotorista(base.motorista_fixo_codigo ?? '', pessoas),
      observacao: '',
    })
  }

  // SPOT: placa fora da frota fixa com mapa D0.
  for (const [pk, rotas0] of porPlaca.entries()) {
    if (vistas.has(pk)) continue
    if (!rotas0.some((r) => r.data_entrega === dataIso)) continue
    const rotas = ordenarRotas(rotas0)
    const primeiro = rotas.find((r) => r.data_entrega === dataIso) ?? rotas[0]
    const placa = primeiro.placa || pk
    const baseSpot: Veiculo = {
      id: `spot-${pk}`,
      placa,
      tipo_veiculo: primeiro.tipo_veiculo || 'SPOT',
      frota: 'SPOT',
      disponibilidade: '',
      motorista_fixo_codigo: null,
      motorista_fixo_nome: null,
      ativo: true,
    }
    resultado.push({
      chave: placa,
      placa,
      isSpot: true,
      base: baseSpot,
      rotas,
      carregado: true,
      temD1: rotas.some((r) => r.data_entrega !== dataIso),
      motorista_codigo: '',
      ajudante_codigo: '',
      ajudante_referencia: '',
      grupo: 'SPOT',
      observacao: '',
    })
  }

  resultado.sort(compararVeiculos)

  const salvasPorPlaca = new Map(salvas.map((s) => [norm(s.veiculo_placa), s]))

  for (const v of resultado) {
    const baseDriver = code(v.base?.motorista_fixo_codigo)
    const baseHelper = v.ajudante_referencia
    const pcdDriver = v.isSpot
      ? code(
          v.rotas.find((r) => code(r.motorista_codigo) && code(r.motorista_codigo) !== '800')
            ?.motorista_codigo,
        )
      : ''
    const carryDriver = v.isSpot ? '' : code(mapaPendencia(v, dataIso)?.motorista_codigo ?? '')
    const motoristaNaBase = disponiveisMotoristas.has(baseDriver)
    const ajudanteNaBase = disponiveisAjudantes.has(baseHelper)

    const def = {
      motorista_codigo: v.isSpot
        ? pcdDriver || ''
        : baseDriver &&
            baseDriver !== '800' &&
            norm(v.base?.motorista_fixo_nome) !== 'PARADO' &&
            motoristaNaBase
          ? baseDriver
          : '',
      ajudante_codigo: v.isSpot
        ? ''
        : baseHelper && (['800', '801'].includes(baseHelper) || ajudanteNaBase)
          ? baseHelper
          : '',
       grupo: v.isSpot ? 'SPOT' : salaDoMotorista(baseDriver, pessoas),
      observacao: '',
    }

    const salva = salvasPorPlaca.get(norm(v.chave)) ?? null
    const estado = {
      ...def,
      ...(salva
        ? {
            // Vaga vazia ainda não inicializada (linha congelada antes do PCD,
            // por exemplo) recebe a equipe pré-definida do carro. Uma limpeza
            // manual fica vazia até alguém escolher outra pessoa.
            motorista_codigo: code(salva.motorista_codigo)
              ? salva.motorista_codigo ?? ''
              : salva.motorista_manual
                ? ''
                : def.motorista_codigo,
            ajudante_codigo: code(salva.ajudante_codigo)
              ? salva.ajudante_codigo ?? ''
              : salva.ajudante_manual
                ? ''
                : def.ajudante_codigo,
            grupo: salva.sala || def.grupo,
            observacao: salva.observacao ?? '',
          }
        : {}),
    }

    // Pernoite / pendência: motorista do mapa anterior aberto é a referência
    // operacional. Se a escala ainda está com a dupla fixa (ou vazia), a equipe
    // fidelizada é liberada para o pool.
    if (carryDriver) {
      const currentDriver = code(estado.motorista_codigo)
      const currentHelper = code(estado.ajudante_codigo)
      const savedDriver = code(salva?.motorista_codigo)
      const savedHelper = code(salva?.ajudante_codigo)
      const driverStillDefault = !salva || !savedDriver || savedDriver === baseDriver
      const helperStillDefault = !salva || !savedHelper || savedHelper === baseHelper
      const driverManual = Boolean(salva?.motorista_manual)
      const helperManual = Boolean(salva?.ajudante_manual)
      if (!driverManual && (driverStillDefault || !currentDriver)) {
        estado.motorista_codigo = carryDriver
      }
      if (!helperManual && helperStillDefault && currentHelper === baseHelper) {
        estado.ajudante_codigo = ''
      }
    }

    // Pessoa removida da Base Equipes não reaparece por causa de ajuste salvo.
    // Exceção: motorista do mapa pendente (vem do PCD) e códigos fixos 800/801.
    if (!v.isSpot) {
      const currentDriver = code(estado.motorista_codigo)
      const currentHelper = code(estado.ajudante_codigo)
      if (currentDriver && !disponiveisMotoristas.has(currentDriver) && currentDriver !== carryDriver) {
        estado.motorista_codigo = ''
      }
      if (
        currentHelper &&
        currentHelper !== '800' &&
        currentHelper !== '801' &&
        !disponiveisAjudantes.has(currentHelper)
      ) {
        estado.ajudante_codigo = ''
      }
    }

    v.motorista_codigo = estado.motorista_codigo
    v.ajudante_codigo = estado.ajudante_codigo
    v.grupo = estado.grupo || v.grupo
    v.observacao = estado.observacao
    if (v.isSpot) v.grupo = 'SPOT'
  }

  normalizarAlocacoes(resultado, dataIso)
  return resultado
}

function ehPendenciaAnterior(mapa: PcdMapa, dataIso: string): boolean {
  return mapa.data_entrega < dataIso && mapaAberto(mapa)
}

function pontuacaoReivindicacao(v: VeiculoEscala, papel: PapelEquipe, c: string, dataIso: string): number {
  if (!v.rotas.length) return 0
  if (!c) return 0
  if (papel === 'motorista' && code(mapaPendencia(v, dataIso)?.motorista_codigo ?? '') === c)
    return 1000
  const hasD0 = v.rotas.some((r) => r.data_entrega === dataIso)
  const fixo = code(papel === 'motorista' ? v.base?.motorista_fixo_codigo : v.ajudante_referencia)
  let score = hasD0 ? 300 : 200
  if (c === fixo) score += 20
  if (v.isSpot) score += 5
  return score
}

/**
 * Uma pessoa só pode ocupar um veículo por vez. Em conflito automático, o
 * pernoite vence a alocação fixa; depois vence o veículo com mapa D0 e, por
 * fim, a primeira alocação operacional de maior prioridade.
 * Veículo sem mapa D0 e sem pendência aberta não reserva equipe.
 */
export function normalizarAlocacoes(veiculos: VeiculoEscala[], dataIso: string): void {
  for (const v of veiculos) {
    if (v.rotas.length) continue
    v.motorista_codigo = ''
    v.ajudante_codigo = ''
  }

  const papeis: [PapelEquipe, 'motorista_codigo' | 'ajudante_codigo'][] = [
    ['motorista', 'motorista_codigo'],
    ['ajudante', 'ajudante_codigo'],
  ]

  for (const [papel, campo] of papeis) {
    const claims = new Map<string, VeiculoEscala[]>()
    for (const v of veiculos) {
      const c = code(v[campo] as string)
      if (!c || (papel === 'ajudante' && (c === '800' || c === '801'))) continue
      if (!claims.has(c)) claims.set(c, [])
      claims.get(c)!.push(v)
    }
    for (const [c, lista] of claims) {
      if (lista.length < 2) continue
      lista.sort(
        (a, b) =>
          pontuacaoReivindicacao(b, papel, c, dataIso) -
            pontuacaoReivindicacao(a, papel, c, dataIso) ||
          String(a.placa).localeCompare(String(b.placa), 'pt-BR', { numeric: true }),
      )
      for (const v of lista.slice(1)) {
        v[campo] = ''
      }
    }
  }
}

/** Estado persistido para a data (congela a escala) com snapshot de nomes. */
export function paraLinhasPersistencia(
  veiculos: VeiculoEscala[],
  dataIso: string,
  pessoas: Colaborador[],
): Omit<EscalaLinha, 'id'>[] {
  const porCodigo = new Map(pessoas.map((p) => [`${p.tipo}|${code(p.codigo)}`, p.nome]))
  return veiculos.map((v) => ({
    data_operacao: dataIso,
    veiculo_placa: v.chave,
    motorista_codigo: v.motorista_codigo,
    motorista_nome: porCodigo.get(`motorista|${code(v.motorista_codigo)}`) ?? '',
    motorista_manual: false,
    ajudante_codigo: v.ajudante_codigo,
    ajudante_nome: porCodigo.get(`ajudante|${code(v.ajudante_codigo)}`) ?? '',
    ajudante_manual: false,
    sala: v.grupo,
    observacao: v.observacao,
  }))
}
