import ExcelJS from 'exceljs'
import { expect, it, vi } from 'vitest'
import { exportarEscalaExcel } from './exportar-excel'
import { entrada, salvar } from './fixtures-arquivo'
import { montarEscala } from './montagem'

it('exporta mapa e equipe arquivados com destaque de pernoite após fechamento no PCD', async () => {
  const inicial = entrada()
  const veiculos = montarEscala({ ...inicial, salvas: salvar(inicial),
    mapas: [{ ...inicial.mapas[0], mpd: 'PC financeira' }] })
  const abaSpy = vi.spyOn(ExcelJS.Workbook.prototype, 'addWorksheet')
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  URL.createObjectURL = vi.fn(() => 'blob:escala-teste')
  URL.revokeObjectURL = vi.fn()
  try {
    await exportarEscalaExcel(inicial.dataIso, veiculos, () => 'NELSON')
    const aba = abaSpy.mock.results[0].value as ExcelJS.Worksheet
    const linha = aba.getRow(2)
    expect(linha.getCell(4).value).toBe('UHJ6F39')
    expect(linha.getCell(6).value).toBe('574742')
    expect(linha.getCell(8).value).toBe('296')
    expect(linha.getCell(9).value).toBe('NELSON')
    expect(linha.getCell(4).fill).toMatchObject({ fgColor: { argb: 'FFFEF9C3' } })
    expect(click).toHaveBeenCalledOnce()
  } finally {
    abaSpy.mockRestore()
    click.mockRestore()
  }
})
