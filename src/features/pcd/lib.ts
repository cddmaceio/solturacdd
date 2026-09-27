import { norm } from '@/lib/texto'
import { difDiasIso } from '@/lib/datas'
import type { PcdMapa } from '@/types/dominio'

/** Situação do MPD: '' (sem informação) | 'Fechado' | 'Aberto'. */
export function situacaoMpd(mpd: string | null): '' | 'Fechado' | 'Aberto' {
  const v = norm(mpd)
  if (!v) return ''
  if (['PC FINANCEIRA', 'PCD FINANCEIRA', 'PC FISICA', 'PCD FISICA'].includes(v)) return 'Fechado'
  return 'Aberto'
}

export function mapaAberto(mapa: Pick<PcdMapa, 'mpd'>): boolean {
  return situacaoMpd(mapa.mpd) === 'Aberto'
}

export function rotuloFaseMpd(mpd: string | null): string {
  const raw = String(mpd ?? '').trim()
  if (!raw) return 'ABERTO'
  const n = norm(raw)
  if (n.includes('CARREG')) return 'CARREGADO'
  if (n.includes('EMITID')) return 'EMITIDO'
  if (n.includes('GERAD')) return 'GERADO'
  if (n.includes('SAIDA') || n.includes('PORTARIA')) return 'SAÍDA'
  return raw.toUpperCase()
}

export function classeFaseMpd(mpd: string | null): string {
  const n = norm(mpd)
  if (n.includes('CARREG')) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (n.includes('EMITID')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (n.includes('GERAD')) return 'bg-sky-50 text-sky-700 border-sky-200'
  if (n.includes('SAIDA') || n.includes('PORTARIA')) return 'bg-violet-50 text-violet-700 border-violet-200'
  return 'bg-sky-50 text-sky-700 border-sky-200'
}

export function ehFreteiro(mapa: Pick<PcdMapa, 'carga'>): boolean {
  return norm(mapa.carga) === 'FRETEIRO'
}

export function ehZumpy(mapa: Pick<PcdMapa, 'transportadora'>): boolean {
  return String(mapa.transportadora ?? '').trim() === '54'
}

export function ehRecarga(mapa: Pick<PcdMapa, 'placa' | 'carga_atual'>): boolean {
  return /^REC\d+$/.test(norm(mapa.placa)) || norm(mapa.carga_atual).includes('RECARGA')
}

export function ehPlacaGenerica(placa: string | null): boolean {
  const n = norm(placa)
  return !n || n === 'VUC0001' || n === 'SEM PLACA' || n === 'SPOT' || /^REC\d+$/.test(n)
}

/** Mapa de data anterior que continua em aberto em relação à data selecionada. */
export function pendenciaAnterior(mapa: PcdMapa, dataSelecionadaIso: string): boolean {
  return difDiasIso(mapa.data_entrega, dataSelecionadaIso) < 0 && mapaAberto(mapa)
}

/** Rótulo exibido da classificação do mapa (sem espaços sobrando). */
export function rotuloClassificacao(classificacao: string | null): string {
  return String(classificacao ?? '').trim()
}

/** Cores da tag de classificação: Noturno cinza, Rota Gradativa laranja. */
export function classeClassificacao(classificacao: string | null): string {
  const n = norm(classificacao)
  if (!n) return 'border-border bg-muted text-muted-foreground'
  if (n.includes('NOTURN')) return 'border-slate-200 bg-slate-100 text-slate-600'
  if (n.includes('GRADATIV')) return 'border-orange-200 bg-orange-50 text-orange-700'
  if (n.includes('RECARGA')) return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  return 'border-sky-200 bg-sky-50 text-sky-700'
}

export function ehD0(mapa: PcdMapa, dataSelecionadaIso: string): boolean {
  return mapa.data_entrega === dataSelecionadaIso
}

/** Mapas visíveis na aba PCD: 100% do D0 + pendências anteriores em aberto. */
export function mapasVisiveis(mapas: PcdMapa[], dataSelecionadaIso: string): PcdMapa[] {
  return mapas.filter((m) => ehD0(m, dataSelecionadaIso) || pendenciaAnterior(m, dataSelecionadaIso))
}
