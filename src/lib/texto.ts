export function norm(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

export function code(valor: unknown): string {
  const texto = String(valor ?? '').trim()
  if (/^0*\d+(\.0+)?$/.test(texto)) {
    const n = Number.parseInt(texto, 10)
    return Number.isFinite(n) ? String(n) : texto
  }
  return texto
}

export function brNum(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0
  const texto = String(valor)
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/\s/g, '')
  const n = Number.parseFloat(texto)
  return Number.isFinite(n) ? n : 0
}

export function pct(valor: unknown): string {
  const n = brNum(valor)
  return n ? `${n.toFixed(1).replace('.', ',')}%` : '—'
}

export function chaveTexto(valor: unknown): string {
  return norm(valor).replace(/[^A-Z0-9]/g, '')
}
