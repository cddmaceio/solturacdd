import { fidelidade, type VeiculoEscala } from '@/features/escala/montagem'
import { norm } from '@/lib/texto'
import type { EscalaLinha, PapelEquipe } from '@/types/dominio'

export function datasPeriodo(fim: string, dias: number): string[] {
  return Array.from({ length: dias }, (_, i) => {
    const data = new Date(`${fim}T12:00:00Z`)
    data.setUTCDate(data.getUTCDate() - dias + 1 + i)
    return data.toISOString().slice(0, 10)
  })
}

/** Usa exclusivamente a referência arquivada; cadastros atuais não reescrevem o histórico. */
export function veiculoArquivado(linha: EscalaLinha): VeiculoEscala | null {
  const s = linha.snapshot
  if (!s) return null
  return {
    chave: linha.id, placa: linha.veiculo_placa, base: s.base, isSpot: s.isSpot,
    rotas: s.rotas, carregado: s.rotas.length > 0,
    temD1: s.rotas.some((r) => r.data_entrega !== linha.data_operacao),
    motorista_codigo: linha.motorista_codigo ?? '', ajudante_codigo: linha.ajudante_codigo ?? '',
    ajudante2_codigo: linha.ajudante2_codigo ?? '', ajudante_referencia: s.ajudante_referencia,
    chapa_codigo: linha.chapa_codigo ?? '', chapa_nome: linha.chapa_nome ?? '',
    grupo: linha.sala ?? '', observacao: linha.observacao ?? '',
  }
}

export function analisarFidelizacao(dias: { data: string; veiculos: VeiculoEscala[] }[], papel: PapelEquipe) {
  const motivos = new Map<string, { motivo: string; quantidade: number }>()
  const evolucao = dias.map(({ data, veiculos }) => {
    let elegiveis = 0
    let fieis = 0
    for (const v of veiculos) {
      if (!v.carregado) continue
      const estado = fidelidade(v, papel)
      if (estado === 'na') continue
      elegiveis++
      if (estado === 'ok') { fieis++; continue }
      const motivo = v.observacao.trim() || 'Sem justificativa'
      const chave = norm(motivo)
      const anterior = motivos.get(chave)
      motivos.set(chave, { motivo: anterior?.motivo ?? motivo, quantidade: (anterior?.quantidade ?? 0) + 1 })
    }
    return { data, elegiveis, fieis, pct: elegiveis ? fieis / elegiveis * 100 : null }
  })
  const elegiveis = evolucao.reduce((s, d) => s + d.elegiveis, 0)
  const fieis = evolucao.reduce((s, d) => s + d.fieis, 0)
  const nok = elegiveis - fieis
  let acumulado = 0
  const pareto = [...motivos.values()]
    .sort((a, b) => b.quantidade - a.quantidade || a.motivo.localeCompare(b.motivo, 'pt-BR'))
    .map((m) => {
      acumulado += m.quantidade
      return { ...m, pct: m.quantidade / nok * 100, acumulado: acumulado / nok * 100, impacto: m.quantidade / elegiveis * 100 }
    })
  return { evolucao, pareto, elegiveis, fieis, nok, pct: elegiveis ? fieis / elegiveis * 100 : null }
}
