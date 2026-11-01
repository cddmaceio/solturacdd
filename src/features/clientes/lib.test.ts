/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { decodificarCsv } from '@/lib/csv'
import { codigoRoteirizador, codigosDoMapa, localizarCliente, parsearBase, temLocalizacao, type Cliente } from './lib'

const cabecalho = 'Código Cliente;Nome Cliente;Endereço;Cidade;Estado;Latitude;Longitude;Setor;Data última compra;Data penúltima compra'
const csvRoteirizador = `${cabecalho}\n15742234;"Mercado; Central";Rua A;Maceió;AL;-9,616584;-35,719296;121 - Barro duro;16/10/2026;02/10/2026`

describe('cruzamento de clientes', () => {
  it('preserva cabeçalhos UTF-8 mesmo se a origem já contiver caracteres danificados', () => {
    expect(decodificarCsv(new TextEncoder().encode('Código Cliente;Nome\n1;Mercado �'))).toContain('Código Cliente')
    expect(decodificarCsv(Uint8Array.from([67, 243, 100, 105, 103, 111]))).toBe('Código')
  })
  it('remove o prefixo somente no código do roteirizador e normaliza zeros', () => {
    expect(codigoRoteirizador('015742234')).toBe('42234')
    expect(codigoRoteirizador('42234')).toBe('42234')
    expect(parsearBase('Cód. cliente;Nome fantasia\n15742;Mercado', 'clientes').registros[0].codigo).toBe('15742')
  })
  it('lê aspas, ponto e vírgula, coordenadas decimais e datas brasileiras', () => {
    expect(parsearBase(csvRoteirizador, 'roteirizador').registros[0]).toMatchObject({
      codigo: '42234', codigo_roteirizador: '15742234', nome: 'Mercado; Central',
      latitude: -9.616584, longitude: -35.719296, ultima_compra: '2026-10-16',
      penultima_compra: '2026-10-02', antepenultima_compra: null,
    })
  })
  it('não inventa a antepenúltima compra e aceita uma coluna adicional quando disponível', () => {
    expect(parsearBase(csvRoteirizador + ';', 'roteirizador').registros[0].antepenultima_compra).toBeNull()
    const csv = csvRoteirizador.replace('Data penúltima compra\n', 'Data penúltima compra;Data antepenúltima compra\n') + ';01/09/2026'
    expect(parsearBase(csv, 'roteirizador').registros[0].antepenultima_compra).toBe('2026-09-01')
  })
  it('rejeita arquivo da outra base, códigos vazios e datas inexistentes', () => {
    expect(() => parsearBase(csvRoteirizador, 'clientes')).toThrow('incompatível')
    expect(() => parsearBase('Cód. cliente;Nome fantasia\n;Mercado', 'clientes')).toThrow('não contém clientes')
    expect(() => parsearBase(csvRoteirizador.replace('16/10/2026', '31/02/2026'), 'roteirizador')).toThrow('Data de compra inválida')
  })
  it('mantém a última ocorrência de um código duplicado', () => {
    expect(parsearBase('Cód. cliente;Nome fantasia\n0042234;Antigo\n42234;Novo', 'clientes')).toEqual({
      registros: [{ codigo: '42234', nome: 'Novo' }], duplicados: 1, ignorados: 0,
    })
  })
  it('não considera coordenadas vazias ou fora do intervalo como localização', () => {
    const semCoordenadas = csvRoteirizador.replace('-9,616584;-35,719296', ';200')
    expect(parsearBase(semCoordenadas, 'roteirizador').registros[0]).toMatchObject({ latitude: null, longitude: null })
    expect(temLocalizacao({ latitude: 0, longitude: 0 } as Cliente)).toBe(false)
    expect(temLocalizacao({ latitude: -9.6, longitude: -35.7 } as Cliente)).toBe(true)
  })
  it('conta linhas sem código sem impedir a importação das válidas', () => {
    expect(parsearBase('Cód. cliente;Nome fantasia\n;Sem código\n0042234;Mercado', 'clientes')).toMatchObject({ ignorados: 1, registros: [{ codigo: '42234', nome: 'Mercado' }] })
  })
  it('resolve clientes do PCD com zeros, elimina repetidos e prioriza códigos exatos', () => {
    expect(codigosDoMapa('0042234/0048184/42234')).toEqual(['42234', '48184'])
    const cliente = { codigo: '42234', nome: 'Mercado' } as Cliente
    const indice = new Map([['42234', cliente]])
    expect(localizarCliente('0042234', indice)).toBe(cliente)
    expect(localizarCliente('15742234', indice)).toBe(cliente)
    expect(localizarCliente('999', indice)).toBeUndefined()
    const exato = { codigo: '15742234' } as Cliente
    indice.set(exato.codigo, exato)
    expect(localizarCliente('15742234', indice)).toBe(exato)
  })
})

// Validação opcional dos arquivos reais, sem copiar dados operacionais para o repositório.
it.skipIf(!process.env.BASE_CLIENTES_CSV || !process.env.BASE_ROTEIRIZADOR_CSV)('valida as duas bases operacionais completas', () => {
  const ler = (caminho: string) => {
    return decodificarCsv(readFileSync(caminho))
  }
  const base = parsearBase(ler(process.env.BASE_CLIENTES_CSV!), 'clientes')
  const rota = parsearBase(ler(process.env.BASE_ROTEIRIZADOR_CSV!), 'roteirizador')
  const codigos = new Set(base.registros.map((c) => c.codigo))
  const cruzados = rota.registros.filter((c) => codigos.has(c.codigo))
  expect(base.registros.length).toBeGreaterThan(0)
  expect(rota.registros.length).toBeGreaterThan(0)
  expect(cruzados.length).toBeGreaterThan(0)
  console.info(`Bases validadas: ${base.registros.length} clientes, ${rota.registros.length} no roteirizador, ${cruzados.length} correspondências.`)
})
