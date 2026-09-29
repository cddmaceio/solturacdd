/** Datas no app: 'DD/MM/AAAA' na UI · 'AAAA-MM-DD' no banco. */

export function paraIso(dmy: string): string {
  const [dd, mm, aaaa] = String(dmy).split('/')
  if (!dd || !mm || !aaaa) return ''
  return `${aaaa}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

export function paraDmy(iso: string): string {
  const [aaaa, mm, dd] = String(iso).split('-')
  if (!aaaa || !mm || !dd) return ''
  return `${dd}/${mm}/${aaaa}`
}

export function dataHojeDmy(): string {
  return paraDmy(dataHojeIso())
}

export function dataHojeIso(): string {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}

export function valorData(dmy: string): number {
  const [dd, mm, aaaa] = String(dmy).split('/').map(Number)
  if (!dd || !mm || !aaaa) return 0
  return aaaa * 10000 + mm * 100 + dd
}

export function ordenarDecrescente(datas: string[]): string[] {
  return [...datas].sort((a, b) => valorData(b) - valorData(a))
}

export function difDiasIso(dataIso: string, referenciaIso: string): number {
  const ms = Date.parse(dataIso) - Date.parse(referenciaIso)
  return Number.isNaN(ms) ? Number.NaN : Math.round(ms / 86_400_000)
}

export function difDias(dmy: string, referencia: string): number {
  const a = paraIso(dmy)
  const b = paraIso(referencia)
  if (!a || !b) return Number.NaN
  return difDiasIso(a, b)
}

export function ehD1(dmy: string, referencia: string): boolean {
  return difDias(dmy, referencia) === -1
}

export function rotuloDiaRelativo(dmy: string, referencia: string): string {
  const delta = difDias(dmy, referencia)
  if (Number.isNaN(delta)) return ''
  if (delta === 0) return 'D0'
  if (delta < 0) return `D-${Math.abs(delta)}`
  return `D+${delta}`
}

export function ultimaData(datas: string[]): string {
  return ordenarDecrescente(datas.filter(Boolean))[0] ?? ''
}

/** Data da escala: hoje quando o PCD mais recente é D0/D-1, senão a última. */
export function dataPreferida(datas: string[]): string {
  const hoje = dataHojeDmy()
  const ultima = ultimaData(datas)
  if (!ultima) return hoje
  const delta = difDias(ultima, hoje)
  return delta === 0 || delta === -1 ? hoje : ultima
}
