import { norm } from '@/lib/texto'

export const TIPOS_VEICULO = [
  { valor: 'Van', rotulo: 'VAN' },
  { valor: 'VULCK', rotulo: 'VULCK' },
  { valor: 'Truck', rotulo: 'TRUCK' },
  { valor: 'Sider', rotulo: 'SIDER' },
  { valor: 'Outro', rotulo: 'OUTRO' },
] as const

export const SITUACOES_DISPONIBILIDADE = [
  { valor: 'Disponível', rotulo: 'Disponível' },
  { valor: 'Indisponível', rotulo: 'Indisponível' },
  { valor: '', rotulo: 'Sem status' },
] as const

export function tipoNormalizado(valor: unknown): string {
  const n = norm(valor)
  if (n.includes('VAN')) return 'VAN'
  if (n.includes('VULCK') || n.includes('VULC') || n === 'VUC' || n.startsWith('VUC') || n.includes('VLC'))
    return 'VULCK'
  if (n.includes('TRUCK')) return 'TRUCK'
  if (n.includes('SIDER')) return 'SIDER'
  return String(valor ?? '').trim().toUpperCase() || 'OUTRO'
}

export function rankingTipo(valor: unknown): number {
  const t = tipoNormalizado(valor)
  return t === 'VAN' ? 0 : t === 'VULCK' ? 1 : t === 'TRUCK' ? 2 : t === 'SIDER' ? 3 : 4
}

/** Ordenação da escala: VAN → VULCK → TRUCK → SIDER → demais, depois placa. */
export function ordenarVeiculos<T extends { placa: string; tipo_veiculo?: string | null }>(
  lista: T[],
): T[] {
  return [...lista].sort(
    (a, b) =>
      rankingTipo(a.tipo_veiculo ?? '') - rankingTipo(b.tipo_veiculo ?? '') ||
      a.placa.localeCompare(b.placa, 'pt-BR', { numeric: true }),
  )
}

export function situacaoDisponibilidade(disponibilidade: string | null): 'ok' | 'ruim' | 'neutro' {
  const n = norm(disponibilidade)
  if (n.includes('INDISP')) return 'ruim'
  if (n.includes('DISPON')) return 'ok'
  return 'neutro'
}

/** Canoniza para as opções do select ('Disponível'/'Indisponível'), ignorando acento/caixa. */
export function canonizarDisponibilidade(valor: string | null | undefined): string {
  const bruto = String(valor ?? '').trim()
  const n = norm(bruto)
  if (n.includes('INDISP')) return 'Indisponível'
  if (n.includes('DISPON')) return 'Disponível'
  return bruto
}
