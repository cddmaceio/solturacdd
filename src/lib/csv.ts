/** Parse de CSV delimitado (suporta aspas, ; e quebras CRLF/CR/LF). */
import { chaveTexto } from '@/lib/texto'

export function separarCsv(texto: string, delimitador = ';'): string[][] {
  const linhas: string[][] = []
  let linha: string[] = []
  let celula = ''
  let entreAspas = false

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (ch === '"') {
      if (entreAspas && texto[i + 1] === '"') {
        celula += '"'
        i++
      } else {
        entreAspas = !entreAspas
      }
    } else if (ch === delimitador && !entreAspas) {
      linha.push(celula)
      celula = ''
    } else if ((ch === '\n' || ch === '\r') && !entreAspas) {
      if (ch === '\r' && texto[i + 1] === '\n') i++
      linha.push(celula)
      celula = ''
      if (linha.some((x) => x !== '')) linhas.push(linha)
      linha = []
    } else {
      celula += ch
    }
  }
  if (celula || linha.length) {
    linha.push(celula)
    linhas.push(linha)
  }
  return linhas
}

/** UTF-8 válido pode conter o caractere � já gravado na origem. */
export function decodificarCsv(buffer: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

/** Detecta UTF-8 pelos bytes; usa Windows-1252 apenas se forem inválidos. */
export async function textoDoArquivo(arquivo: File): Promise<string> {
  const buffer = await arquivo.arrayBuffer()
  return decodificarCsv(buffer)
}

export type CabecalhosCsv = {
  cabecalhos: string[]
  ler: (linha: string[], cabecalho: string) => string
}

export function cabecalhosCsv(primeiraLinha: string[]): CabecalhosCsv {
  const cabecalhos = primeiraLinha.map((c) => c.trim())
  const chaves = cabecalhos.map((c) => chaveTexto(c))
  return {
    cabecalhos,
    ler: (linha, cabecalho) => {
      let i = cabecalhos.indexOf(cabecalho)
      if (i < 0) i = chaves.indexOf(chaveTexto(cabecalho))
      return i >= 0 ? (linha[i] ?? '').trim() : ''
    },
  }
}

/** Gera CSV (;, com BOM) e baixa no navegador. Números usam vírgula decimal (Excel pt-BR). */
export function baixarCsv(nomeArquivo: string, linhas: (string | number | null | undefined)[][]) {
  const celula = (v: string | number | null | undefined): string => {
    const texto =
      typeof v === 'number' && Number.isFinite(v)
        ? Number.isInteger(v)
          ? String(v)
          : v.toFixed(2).replace('.', ',')
        : String(v ?? '')
    return `"${texto.replace(/"/g, '""')}"`
  }
  const csv = linhas.map((linha) => linha.map(celula).join(';')).join('\r\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(a.href)
}
