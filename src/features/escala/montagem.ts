import { brNum, code, norm } from '@/lib/texto'
import { dataHojeIso } from '@/lib/datas'
import { mapaAberto, situacaoMpd, ehFreteiro, ehPlacaGenerica, ehZumpy } from '@/features/pcd/lib'
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
  ajudante2_codigo: string
  ajudante_referencia: string
  ajudante_referencia_nome?: string
  chapa_codigo: string
  chapa_nome: string
  grupo: string
  observacao: string
}

export type EntradaMontagem = {
  hojeIso?: string
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
    .map((r) => r.ocupacao_caixas_pct)
    .filter((x): x is number => x != null)
  const occWeights = v.rotas
    .map((r) => r.ocupacao_peso_pct)
    .filter((x): x is number => x != null)
  const tempoMinutos = v.rotas.reduce((s, r) => s + minutosTempo(r.tempo_previsto), 0)
  return {
    km,
    entregas,
    ocupacaoCaixas: occs.length ? Math.max(...occs) : 0,
    ocupacaoPeso: occWeights.length ? Math.max(...occWeights) : 0,
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

export function chaveMapa(m: PcdMapa): string {
  return JSON.stringify([m.data_entrega, m.mapa, norm(m.placa)])
}

function identidadeMapa(m: PcdMapa): string {
  return JSON.stringify([m.data_entrega, norm(m.mapa)])
}

export function destaqueLinha(v: VeiculoEscala, dataIso: string): 'pernoite' | 'gradativa' | 'noturna' | '' {
  if (v.rotas.some((m) => m.data_entrega < dataIso)) return 'pernoite'
  if (v.rotas.some((m) => norm(m.classificacao).includes('GRADATIV'))) return 'gradativa'
  if (v.rotas.some((m) => norm(m.classificacao).includes('NOTURN'))) return 'noturna'
  return ''
}

/** O arquivo salvo é soberano; o PCD só acrescenta mapas em dias não encerrados. */
export function montarEscala(entrada: EntradaMontagem): VeiculoEscala[] {
  const passado = entrada.dataIso < (entrada.hojeIso ?? dataHojeIso())
  const fechados = new Set(entrada.mapas.filter((m) =>
    m.data_entrega < entrada.dataIso && situacaoMpd(m.mpd) === 'Fechado',
  ).map(chaveMapa))
  const mapasAtualizadosPcd = new Set(entrada.mapas.map(identidadeMapa))
  const manterRota = (m: PcdMapa) => passado || !fechados.has(chaveMapa(m))
  const salvas = new Map(entrada.salvas.map((s) => [norm(s.veiculo_placa), s]))
  const bases = new Map(entrada.veiculos.map((v) => [norm(v.placa), v]))
  for (const s of entrada.salvas) {
    const base = s.snapshot?.base ?? bases.get(norm(s.veiculo_placa)) ?? {
      id: s.id, placa: s.veiculo_placa, tipo_veiculo: '', frota: '', disponibilidade: '',
      territorio: '', motorista_fixo_codigo: null, motorista_fixo_nome: null, ativo: false,
    }
    bases.set(norm(s.veiculo_placa), base)
  }
  const mapas = new Map<string, PcdMapa>()
  for (const s of entrada.salvas) {
    for (const m of s.snapshot?.rotas ?? []) {
      if (!manterRota(m)) continue
      if (!passado && mapasAtualizadosPcd.has(identidadeMapa(m))) continue
      mapas.set(chaveMapa(m), m)
    }
  }
  for (const m of entrada.mapas) {
    // Legado: D0 é identificável; pernoites antigos não são inferidos.
    const salva = salvas.get(norm(m.placa))
    if (passado && (salva?.snapshot || !salva || m.data_entrega !== entrada.dataIso)) continue
    if (!mapas.has(chaveMapa(m))) mapas.set(chaveMapa(m), m)
  }
  const resultado = montarReferenciaEscala({
    ...entrada,
    veiculos: [...bases.values()].filter((v) => !passado || salvas.has(norm(v.placa))),
    mapas: [...mapas.values()],
  })
  const protegidos = new Set<VeiculoEscala>()
  const novosPernoites = new Set<VeiculoEscala>()
  for (const v of resultado) {
    const s = salvas.get(norm(v.placa))
    if (!s) continue
    const snap = s.snapshot
    if (snap) {
      const rotas = new Map(snap.rotas
        .filter(manterRota)
        .filter((m) => passado || !mapasAtualizadosPcd.has(identidadeMapa(m)))
        .map((m) => [chaveMapa(m), m]))
      if (!passado) for (const m of v.rotas) if (!rotas.has(chaveMapa(m))) rotas.set(chaveMapa(m), m)
      v.rotas = [...rotas.values()]
      v.base = snap.base
      v.isSpot = snap.isSpot
      v.ajudante_referencia = snap.ajudante_referencia
      v.ajudante_referencia_nome = snap.ajudante_referencia_nome
    }
    v.carregado = v.rotas.length > 0
    v.temD1 = v.rotas.some((m) => m.data_entrega < entrada.dataIso)
    const inicializando = !passado && (!snap || !snap.rotas.length) && v.carregado
    for (const slot of ['motorista', 'ajudante', 'ajudante2', 'chapa'] as const) {
      const campo = `${slot}_codigo` as const
      if (!inicializando || s[`${slot}_manual`] || code(s[campo]) || (slot === 'chapa' && s.chapa_nome)) {
        v[campo] = s[campo] ?? ''
      }
    }
    const carry = mapaPendencia(v, entrada.dataIso)
    const novoPernoite = !passado && carry && !snap?.rotas.some((m) => chaveMapa(m) === chaveMapa(carry))
    if (novoPernoite) {
      if (!s.motorista_manual) {
        v.motorista_codigo = code(carry.motorista_codigo)
        novosPernoites.add(v)
      }
      if (!s.ajudante_manual && code(s.ajudante_codigo) === code(v.ajudante_referencia)) v.ajudante_codigo = ''
    }
    v.chapa_nome = s.chapa_nome ?? ''
    v.grupo = s.sala ?? ''
    v.observacao = s.observacao ?? ''
    protegidos.add(v)
  }
  for (const v of resultado) {
    if (!salvas.has(norm(v.placa)) && mapaPendencia(v, entrada.dataIso)) novosPernoites.add(v)
  }
  for (const pernoite of novosPernoites) {
    for (const v of resultado) {
      if (v === pernoite || novosPernoites.has(v)) continue
      const salva = salvas.get(norm(v.placa))
      if (!salva?.motorista_manual && code(v.motorista_codigo) === code(pernoite.motorista_codigo)) v.motorista_codigo = ''
    }
  }
  // Uma nova sugestão nunca desloca alguém de uma alocação já salva.
  for (const campos of [['motorista_codigo'], ['ajudante_codigo', 'ajudante2_codigo', 'chapa_codigo']] as const) {
    const ocupados = new Set<string>()
    for (const v of resultado) {
      const s = salvas.get(norm(v.placa))
      for (const campo of campos) {
        if (s && code(s[campo]) === code(v[campo])) ocupados.add(code(v[campo]))
      }
    }
    for (const v of [...resultado.filter((v) => protegidos.has(v)), ...resultado.filter((v) => !protegidos.has(v))]) {
      const s = salvas.get(norm(v.placa))
      for (const campo of campos) {
        const c = code(v[campo])
        if (!c || (campo !== 'motorista_codigo' && ['800', '801'].includes(c))) continue
        if (s && code(s[campo]) === c) continue
        if (ocupados.has(c)) v[campo] = ''
        else ocupados.add(c)
      }
    }
  }
  return resultado
    .filter((v) => !entrada.salvas.length || salvas.has(norm(v.placa)) || v.carregado)
    .sort(compararVeiculos)
}

export function montarReferenciaEscala(entrada: EntradaMontagem): VeiculoEscala[] {
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
      ajudante2_codigo: '',
      ajudante_referencia: ajudantePorMotorista.get(code(base.motorista_fixo_codigo)) ?? '',
      chapa_codigo: '',
      chapa_nome: '',
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
      territorio: '',
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
      ajudante2_codigo: '',
      ajudante_referencia: '',
      chapa_codigo: '',
      chapa_nome: '',
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
      ajudante2_codigo: '',
      chapa_codigo: '',
      chapa_nome: '',
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
            ajudante2_codigo: code(salva.ajudante2_codigo)
              ? salva.ajudante2_codigo ?? ''
              : salva.ajudante2_manual
                ? ''
                : def.ajudante2_codigo,
            chapa_codigo: code(salva.chapa_codigo)
              ? salva.chapa_codigo ?? ''
              : salva.chapa_manual
                ? ''
                : def.chapa_codigo,
            chapa_nome: salva.chapa_nome ?? '',
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
      const savedHelper2 = code(salva?.ajudante2_codigo)
      const driverStillDefault = !salva || !savedDriver || savedDriver === baseDriver
      const helperStillDefault = !salva || !savedHelper || savedHelper === baseHelper
      const driverManual = Boolean(salva?.motorista_manual)
      const helperManual = Boolean(salva?.ajudante_manual)
      const helper2Manual = Boolean(salva?.ajudante2_manual)
      if (!driverManual && (driverStillDefault || !currentDriver)) {
        estado.motorista_codigo = carryDriver
      }
      if (!helperManual && helperStillDefault && currentHelper === baseHelper) {
        estado.ajudante_codigo = ''
      }
      if (!helper2Manual && (!salva || !savedHelper2)) estado.ajudante2_codigo = ''
    }

    // Pessoa removida da Base Equipes não reaparece por causa de ajuste salvo.
    // Exceção: motorista do mapa pendente (vem do PCD) e códigos fixos 800/801.
    if (!v.isSpot) {
      const currentDriver = code(estado.motorista_codigo)
      if (currentDriver && !disponiveisMotoristas.has(currentDriver) && currentDriver !== carryDriver) {
        estado.motorista_codigo = ''
      }
      for (const campo of ['ajudante_codigo', 'ajudante2_codigo'] as const) {
        const currentHelper = code(estado[campo])
        if (
          currentHelper &&
          currentHelper !== '800' &&
          currentHelper !== '801' &&
          !disponiveisAjudantes.has(currentHelper)
        ) {
          estado[campo] = ''
        }
      }
    }

    v.motorista_codigo = estado.motorista_codigo
    v.ajudante_codigo = estado.ajudante_codigo
    v.ajudante2_codigo = estado.ajudante2_codigo
    v.chapa_codigo = estado.chapa_codigo
    v.chapa_nome = estado.chapa_nome
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

function pontuacaoReivindicacao(
  v: VeiculoEscala,
  papel: PapelEquipe,
  c: string,
  dataIso: string,
  campo: 'motorista_codigo' | 'ajudante_codigo' | 'ajudante2_codigo' | 'chapa_codigo',
): number {
  if (!v.rotas.length) return 0
  if (!c) return 0
  if (papel === 'motorista' && code(mapaPendencia(v, dataIso)?.motorista_codigo ?? '') === c)
    return 1000
  const hasD0 = v.rotas.some((r) => r.data_entrega === dataIso)
  const fixo = code(papel === 'motorista' ? v.base?.motorista_fixo_codigo : v.ajudante_referencia)
  let score = hasD0 ? 300 : 200
  if (c === fixo && (papel === 'motorista' || campo === 'ajudante_codigo')) score += 20
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
    v.ajudante2_codigo = ''
    v.chapa_codigo = ''
    v.chapa_nome = ''
  }

  const papeis: [PapelEquipe, ('motorista_codigo' | 'ajudante_codigo' | 'ajudante2_codigo' | 'chapa_codigo')[]][] = [
    ['motorista', ['motorista_codigo']],
    ['ajudante', ['ajudante_codigo', 'ajudante2_codigo', 'chapa_codigo']],
  ]

  for (const [papel, campos] of papeis) {
    const claims = new Map<string, { veiculo: VeiculoEscala; campo: 'motorista_codigo' | 'ajudante_codigo' | 'ajudante2_codigo' | 'chapa_codigo' }[]>()
    for (const v of veiculos) {
      for (const campo of campos) {
        const c = code(v[campo])
        if (!c || (papel === 'ajudante' && (c === '800' || c === '801'))) continue
        if (!claims.has(c)) claims.set(c, [])
        claims.get(c)!.push({ veiculo: v, campo })
      }
    }
    for (const [c, lista] of claims) {
      if (lista.length < 2) continue
      lista.sort(
        (a, b) =>
          pontuacaoReivindicacao(b.veiculo, papel, c, dataIso, b.campo) -
            pontuacaoReivindicacao(a.veiculo, papel, c, dataIso, a.campo) ||
          String(a.veiculo.placa).localeCompare(String(b.veiculo.placa), 'pt-BR', { numeric: true }),
      )
      for (const claim of lista.slice(1)) {
        claim.veiculo[claim.campo] = ''
        if (claim.campo === 'chapa_codigo') claim.veiculo.chapa_nome = ''
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
    snapshot: {
      versao: 1, base: v.base, isSpot: v.isSpot, ajudante_referencia: v.ajudante_referencia,
      ajudante_referencia_nome: v.ajudante_referencia_nome ?? porCodigo.get(`ajudante|${code(v.ajudante_referencia)}`) ?? '',
      rotas: v.rotas,
    },
    data_operacao: dataIso,
    veiculo_placa: v.chave,
    motorista_codigo: v.motorista_codigo,
    motorista_nome: porCodigo.get(`motorista|${code(v.motorista_codigo)}`) ?? '',
    motorista_manual: false,
    ajudante_codigo: v.ajudante_codigo,
    ajudante_nome: porCodigo.get(`ajudante|${code(v.ajudante_codigo)}`) ?? '',
    ajudante_manual: false,
    ajudante2_codigo: v.ajudante2_codigo,
    ajudante2_nome: porCodigo.get(`ajudante|${code(v.ajudante2_codigo)}`) ?? '',
    ajudante2_manual: false,
    chapa_codigo: v.chapa_codigo,
    chapa_nome: v.chapa_nome || (code(v.chapa_codigo) ? porCodigo.get(`ajudante|${code(v.chapa_codigo)}`) ?? '' : ''),
    chapa_manual: false,
    sala: v.grupo,
    observacao: v.observacao,
  }))
}
