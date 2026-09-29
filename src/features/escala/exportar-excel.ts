import { code } from '@/lib/texto'
import { destaqueLinha, estatisticasVeiculo, fidelidade, rotuloTipoVeiculo, type VeiculoEscala } from './montagem'
import type { PapelEquipe } from '@/types/dominio'

type NomeDe = (papel: PapelEquipe, codigo: string) => string | null

/** Exporta a escala inteira da data consultada, independentemente dos filtros da tela. */
export async function exportarEscalaExcel(dataIso: string, veiculos: VeiculoEscala[], nomeDe: NomeDe) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const aba = workbook.addWorksheet('Escala do dia', { views: [{ state: 'frozen', ySplit: 1 }] })
  const cabecalhos = [
    'Data', 'Sala', 'Tipo', 'Placa', 'Frota', 'Mapa(s)', 'AS / Rota',
    'Motorista código', 'Motorista', 'Ajudante código', 'Ajudante',
    'Ajudante 2 código', 'Ajudante 2', 'Chapa/PX código', 'Chapa/PX',
    'Motorista fixo', 'Ajudante referência', 'Fidelização frota',
    'Fidelização ajudante', 'KM', 'Entregas', 'Ocupação peso %',
    'Tempo previsto', 'Região', 'Justificativa NOK',
  ]
  aba.addRow(cabecalhos)
  aba.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  aba.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324F' } }
  aba.autoFilter = { from: 'A1', to: 'Y1' }
  aba.columns = cabecalhos.map((_, i) => ({ width: [14, 15, 13, 15, 12, 22, 14, 18, 27, 18, 27, 19, 27, 19, 27, 28, 20, 18, 21, 12, 12, 20, 17, 32, 24][i] }))

  for (const v of veiculos) {
    const stats = estatisticasVeiculo(v)
    const pessoa = (papel: PapelEquipe, codigo: string) => code(codigo) ? nomeDe(papel, codigo) ?? '' : ''
    const linha = aba.addRow([
      dataIso, v.grupo, rotuloTipoVeiculo(v), v.placa,
      v.isSpot ? 'SPOT' : v.base?.frota ?? '',
      v.rotas.map((r) => r.mapa).join(' | '),
      [...new Set(v.rotas.map((r) => r.as_rota).filter(Boolean))].join(' / '),
      code(v.motorista_codigo), pessoa('motorista', v.motorista_codigo),
      code(v.ajudante_codigo), pessoa('ajudante', v.ajudante_codigo),
      code(v.ajudante2_codigo), pessoa('ajudante', v.ajudante2_codigo),
      code(v.chapa_codigo), v.chapa_nome || pessoa('ajudante', v.chapa_codigo),
      v.base?.motorista_fixo_nome ?? '',
      v.ajudante_referencia_nome ?? pessoa('ajudante', v.ajudante_referencia),
      fidelidade(v, 'motorista'), fidelidade(v, 'ajudante'),
      stats.km, stats.entregas, stats.ocupacaoPeso, stats.tempoRotulo,
      v.rotas.map((r) => r.regiao).filter(Boolean).join(' | '), v.observacao,
    ])
    const destaque = destaqueLinha(v, dataIso)
    const cor = destaque === 'pernoite' ? 'FFFEF9C3' : destaque === 'gradativa' ? 'FFFFEDD5' : destaque === 'noturna' ? 'FFE2E8F0' : null
    if (cor) linha.eachCell((celula) => { celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor } } })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `escala_${dataIso}.xlsx`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
