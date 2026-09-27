import type ExcelJS from 'exceljs'
import { chaveTexto, norm } from '@/lib/texto'

export type AbaEncontrada = {
  nome: string
  linhas: unknown[][]
  chaves: string[]
}

export async function carregarPlanilha(arquivo: File): Promise<ExcelJS.Workbook> {
  const [{ default: ExcelJSModulo }, buffer] = await Promise.all([
    import('exceljs'),
    arquivo.arrayBuffer(),
  ])
  const wb = new ExcelJSModulo.Workbook()
  await wb.xlsx.load(buffer)
  return wb
}

function valorCelula(valor: ExcelJS.CellValue): unknown {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'object') {
    if ('richText' in valor) return valor.richText.map((r) => r.text).join('')
    if ('text' in valor) return valor.text
    if ('result' in valor) return valor.result
    if (valor instanceof Date) return valor
    if ('hyperlink' in valor) return valor.hyperlink
  }
  return valor
}

/** Converte uma aba em linhas de arrays (equivalente a sheet_to_json header:1). */
export function linhasDaAba(wb: ExcelJS.Workbook, nome: string): unknown[][] {
  const ws = wb.getWorksheet(nome)
  if (!ws) return []
  const linhas: unknown[][] = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    const valores = row.values as ExcelJS.CellValue[]
    const linha: unknown[] = []
    for (let i = 1; i < valores.length; i++) linha.push(valorCelula(valores[i]))
    linhas.push(linha)
  })
  return linhas
}

/** Localiza a aba cujo cabeçalho contém TODOS os cabeçalhos requeridos. */
export function encontrarAba(
  wb: ExcelJS.Workbook,
  cabecalhosRequeridos: string[],
): AbaEncontrada | null {
  for (const ws of wb.worksheets) {
    const linhas = linhasDaAba(wb, ws.name)
    if (!linhas.length) continue
    const cabecalhos = (linhas[0] ?? []).map((c) => chaveTexto(c))
    if (cabecalhosRequeridos.every((alvo) => cabecalhos.includes(alvo))) {
      return { nome: ws.name, linhas, chaves: cabecalhos }
    }
  }
  return null
}

/** Texto limpo de uma célula (colapsa espaços). */
export function celula(valor: unknown): string {
  return String(valor ?? '').replace(/\s+/g, ' ').trim()
}

export function indiceColuna(chaves: string[], cabecalho: string): number {
  return chaveTexto(cabecalho).length ? chaves.indexOf(chaveTexto(cabecalho)) : -1
}

/** Lê o valor de uma linha pelo cabeçalho (ex.: 'Cod. M.'). */
export function ler(linha: unknown[], chaves: string[], cabecalho: string): string {
  const i = chaves.indexOf(chaveTexto(cabecalho))
  return i >= 0 ? celula(linha[i]) : ''
}

export function temColuna(chaves: string[], cabecalho: string): boolean {
  return chaves.includes(chaveTexto(cabecalho))
}

export function normCabecalho(valor: unknown): string {
  return norm(valor)
}
