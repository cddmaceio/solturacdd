import { cabecalhosCsv, separarCsv } from '@/lib/csv'
import { chaveTexto, code } from '@/lib/texto'

export type TipoBase = 'clientes' | 'roteirizador'
export type Cliente = {
  codigo: string
  nome: string
  codigo_roteirizador: string | null
  endereco: string | null
  cidade: string | null
  estado: string | null
  setor: string | null
  bairro: string | null
  latitude: number | null
  longitude: number | null
  ultima_compra: string | null
  penultima_compra: string | null
  antepenultima_compra: string | null
  na_base_clientes: boolean
  na_base_roteirizador: boolean
}

export function codigoRoteirizador(valor: string): string {
  const codigo = code(valor)
  return codigo.startsWith('157') && codigo.length > 3 ? code(codigo.slice(3)) : codigo
}

function coordenada(valor: string, limite: number): number | null {
  if (!valor || valor === '-') return null
  const numero = Number(valor.replace(',', '.'))
  return Number.isFinite(numero) && Math.abs(numero) <= limite ? numero : null
}

function dataCompra(valor: string): string | null {
  if (!valor || valor === '-') return null
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor)
  if (!partes) throw new Error(`Data de compra inválida: ${valor}`)
  const iso = `${partes[3]}-${partes[2]}-${partes[1]}`
  const data = new Date(`${iso}T12:00:00Z`)
  if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== iso) throw new Error(`Data de compra inválida: ${valor}`)
  return iso
}

export function parsearBase(texto: string, tipo: TipoBase) {
  const [cabecalho, ...linhas] = separarCsv(texto.replace(/^\uFEFF/, ''))
  const obrigatorias = tipo === 'clientes' ? ['Cód. cliente', 'Nome fantasia'] : ['Código Cliente', 'Nome Cliente', 'Endereço', 'Latitude', 'Longitude', 'Setor', 'Data última compra', 'Data penúltima compra']
  const chaves = (cabecalho ?? []).map(chaveTexto)
  if (!obrigatorias.every((coluna) => chaves.includes(chaveTexto(coluna)))) {
    throw new Error(`Arquivo incompatível com a base ${tipo}. Colunas necessárias: ${obrigatorias.join(', ')}.`)
  }
  const { ler } = cabecalhosCsv(cabecalho)
  const registros = new Map<string, Record<string, string | number | null>>()
  let duplicados = 0
  let ignorados = 0
  for (const linha of linhas) {
    const original = ler(linha, tipo === 'clientes' ? 'Cód. cliente' : 'Código Cliente')
    const codigo = tipo === 'clientes' ? code(original) : codigoRoteirizador(original)
    const nome = ler(linha, tipo === 'clientes' ? 'Nome fantasia' : 'Nome Cliente')
    if (!/^\d+$/.test(codigo) || !nome) { ignorados++; continue }
    if (registros.has(codigo)) duplicados++
    registros.set(codigo, tipo === 'clientes' ? { codigo, nome } : {
      codigo, nome, codigo_roteirizador: code(original),
      endereco: ler(linha, 'Endereço'), cidade: ler(linha, 'Cidade'), estado: ler(linha, 'Estado'),
      setor: ler(linha, 'Setor'), bairro: ler(linha, 'Bairro') || null, latitude: coordenada(ler(linha, 'Latitude'), 90),
      longitude: coordenada(ler(linha, 'Longitude'), 180),
      ultima_compra: dataCompra(ler(linha, 'Data última compra')),
      penultima_compra: dataCompra(ler(linha, 'Data penúltima compra')),
      antepenultima_compra: dataCompra(ler(linha, 'Data antepenúltima compra')),
    })
  }
  if (!registros.size) throw new Error('O arquivo não contém clientes.')
  return { registros: [...registros.values()], duplicados, ignorados }
}

export function codigosDoMapa(clientes: string | null): string[] {
  return [...new Set((clientes?.match(/\d+/g) ?? []).map(code))]
}

export function localizarCliente(codigo: string, indice: Map<string, Cliente>): Cliente | undefined {
  return indice.get(code(codigo)) ?? indice.get(codigoRoteirizador(codigo))
}

export function temLocalizacao(cliente: Cliente): boolean {
  return cliente.latitude != null && cliente.longitude != null &&
    Math.abs(cliente.latitude) <= 90 && Math.abs(cliente.longitude) <= 180 &&
    !(cliente.latitude === 0 && cliente.longitude === 0)
}
