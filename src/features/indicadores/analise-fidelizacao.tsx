import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { VeiculoEscala } from '@/features/escala/montagem'
import type { PapelEquipe } from '@/types/dominio'
import { dataHojeIso, paraDmy } from '@/lib/datas'
import { useHistoricoFidelizacao } from './api'
import { analisarFidelizacao, datasPeriodo, veiculoArquivado } from './fidelizacao'

const numero = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const percentual = (n: number | null) => n === null ? 'Sem base' : `${numero(n)}%`

export function AnaliseFidelizacao({ dataIso, veiculos }: { dataIso: string; veiculos: VeiculoEscala[] }) {
  const [papel, setPapel] = useState<PapelEquipe>('motorista')
  const fim = dataHojeIso()
  const periodo = Number(fim.slice(8, 10))
  const datas = useMemo(() => datasPeriodo(fim, periodo), [fim, periodo])
  const historico = useHistoricoFidelizacao(datas[0], fim)
  const linhas = historico.data
  const { dias, semArquivo } = useMemo(() => {
    const porData = new Map<string, VeiculoEscala[]>()
    let semArquivo = 0
    for (const linha of linhas ?? []) {
      if (linha.data_operacao === dataIso) continue
      const v = veiculoArquivado(linha)
      if (!v) { semArquivo++; continue }
      const lista = porData.get(linha.data_operacao) ?? []
      lista.push(v)
      porData.set(linha.data_operacao, lista)
    }
    return {
      dias: datas.map((data) => ({ data, veiculos: data === dataIso ? veiculos : porData.get(data) ?? [] })),
      semArquivo,
    }
  }, [linhas, datas, dataIso, veiculos])
  const analise = useMemo(() => analisarFidelizacao(dias, papel), [dias, papel])
  const largura = Math.max(700, periodo * 44 + 90)
  const altura = 270
  const esquerda = 48
  const topo = 24
  const base = 218
  const passo = (largura - esquerda - 20) / periodo
  const y = (pct: number) => base - pct / 100 * (base - topo)
  const paretoLargura = Math.max(700, analise.pareto.length * 100 + 100)
  const paretoPasso = (paretoLargura - 100) / Math.max(1, analise.pareto.length)
  const maximo = Math.max(1, ...analise.pareto.map((p) => p.quantidade))

  return (
    <section className="space-y-4" aria-label="Análise de fidelização">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Análise de fidelização</h2>
          <p className="text-xs text-muted-foreground">Mês atual · {paraDmy(datas[0])} a {paraDmy(fim)} · Apenas veículos carregados com referência fixa válida.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-1" role="group" aria-label="Tipo de fidelização">
            {(['motorista', 'ajudante'] as const).map((p) => (
              <Button key={p} size="sm" variant={papel === p ? 'default' : 'outline'} aria-pressed={papel === p} onClick={() => setPapel(p)}>
                {p === 'motorista' ? 'Frota' : 'Ajudante'}
              </Button>
            ))}
          </div>
        </div>
      </div>
      {historico.isPending ? <p className="p-6 text-sm text-muted-foreground" role="status">Carregando histórico de fidelização…</p> : historico.isError ? (
        <div className="rounded-xl border p-4 text-sm text-destructive" role="alert">
          Não foi possível carregar o histórico: {historico.error.message}
          <Button className="ml-3" variant="outline" size="sm" onClick={() => void historico.refetch()}>Tentar novamente</Button>
        </div>
      ) : <>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Fidelização no período', percentual(analise.pct), `${analise.fieis} de ${analise.elegiveis} veículos-dia elegíveis`],
            ['Quebras de fidelização', String(analise.nok), 'Ocorrências NOK no período'],
            ['Principal justificativa', analise.pareto[0]?.motivo ?? 'Sem ocorrências', analise.pareto[0] ? `${percentual(analise.pareto[0].pct)} dos NOK · ${numero(analise.pareto[0].impacto)} p.p. de impacto` : 'Nenhum NOK identificado'],
          ].map(([titulo, valor, detalhe]) => <div key={titulo} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{titulo}</p>
            <p className="my-1 text-xl font-semibold tracking-tight">{valor}</p>
            <p className="text-xs text-muted-foreground">{detalhe}</p>
          </div>)}
        </div>
        {semArquivo > 0 && <p className="text-xs text-muted-foreground">{semArquivo} registro(s) antigo(s) sem referência arquivada foram excluídos do histórico.</p>}
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Fidelização dia a dia · {papel === 'motorista' ? 'Frota' : 'Ajudante'}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Colunas: percentual diário · Linha tracejada: meta de 70% · Passe sobre as colunas para ver os volumes.</p>
          <div className="mt-3 overflow-x-auto">
            <svg width={largura} height={altura} role="img" aria-label="Gráfico de colunas da fidelização diária, com meta de 70%" className="text-muted-foreground">
              {[0, 25, 50, 75, 100].map((pct) => <g key={pct}>
                <line x1={esquerda} x2={largura - 20} y1={y(pct)} y2={y(pct)} stroke="currentColor" opacity="0.15" />
                <text x={esquerda - 8} y={y(pct) + 4} textAnchor="end" fill="currentColor" fontSize="10">{pct}%</text>
              </g>)}
              <line x1={esquerda} x2={largura - 20} y1={y(70)} y2={y(70)} stroke="#d97706" strokeDasharray="5 4" />
              {analise.evolucao.map((d, i) => {
                const x = esquerda + passo * (i + 0.5)
                return <g key={d.data}>
                  <title>{paraDmy(d.data)}: {percentual(d.pct)} · {d.fieis}/{d.elegiveis} fiéis</title>
                  {d.pct !== null ? <>
                    <rect x={x - 12} y={y(d.pct)} width={24} height={Math.max(1, base - y(d.pct))} rx="3" fill={d.pct >= 70 ? '#059669' : '#e11d48'} />
                    <text x={x} y={y(d.pct) - 6} textAnchor="middle" fill="currentColor" fontSize="10">{numero(d.pct)}%</text>
                  </> : <text x={x} y={base - 8} textAnchor="middle" fill="currentColor" fontSize="10">—</text>}
                  <text x={x} y={base + 22} textAnchor="middle" fill="currentColor" fontSize="10">{paraDmy(d.data).slice(0, 5)}</text>
                </g>
              })}
            </svg>
          </div>
          <p className="text-xs text-muted-foreground">Dias sem base elegível aparecem como “—”. O percentual do período considera a soma dos volumes, e o dia selecionado reflete a escala exibida.</p>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground">Consultar valores diários</summary>
            <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Fiéis</TableHead><TableHead>Elegíveis</TableHead><TableHead>Fidelização</TableHead></TableRow></TableHeader>
              <TableBody>{analise.evolucao.map((d) => <TableRow key={d.data}><TableCell>{paraDmy(d.data)}</TableCell><TableCell>{d.fieis}</TableCell><TableCell>{d.elegiveis}</TableCell><TableCell>{percentual(d.pct)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </details>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Pareto das justificativas de NOK</h3>
          <p className="mt-1 text-xs text-muted-foreground">Colunas azuis: ocorrências por motivo · Linha laranja: percentual acumulado dos NOK · Referência tracejada: 80%.</p>
          {analise.nok === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{analise.elegiveis ? 'Nenhuma quebra de fidelização no período.' : 'Sem base elegível no período para analisar as justificativas.'}</p> : <>
            <div className="mt-3 overflow-x-auto">
              <svg width={paretoLargura} height={altura} role="img" aria-label="Pareto de justificativas: quantidades em ordem decrescente e percentual acumulado" className="text-muted-foreground">
                {[0, 25, 50, 75, 100].map((pct) => <g key={pct}>
                  <line x1="48" x2={paretoLargura - 48} y1={y(pct)} y2={y(pct)} stroke="currentColor" opacity="0.15" />
                  <text x="40" y={y(pct) + 4} textAnchor="end" fill="currentColor" fontSize="10">{numero(maximo * pct / 100)}</text>
                  <text x={paretoLargura - 40} y={y(pct) + 4} fill="currentColor" fontSize="10">{pct}%</text>
                </g>)}
                <line x1="48" x2={paretoLargura - 48} y1={y(80)} y2={y(80)} stroke="#d97706" strokeDasharray="5 4" opacity="0.6" />
                {analise.pareto.map((p, i) => {
                  const x = 48 + paretoPasso * (i + 0.5)
                  return <g key={p.motivo}>
                    <title>{p.motivo}: {p.quantidade} NOK · {percentual(p.pct)} · Acumulado {percentual(p.acumulado)} · Impacto {numero(p.impacto)} p.p.</title>
                    <rect x={x - 22} y={y(p.quantidade / maximo * 100)} width="44" height={base - y(p.quantidade / maximo * 100)} rx="3" fill="#0284c7" />
                    <text x={x} y={base + 20} textAnchor="middle" fill="currentColor" fontSize="10">{i + 1}. {p.motivo.length > 13 ? `${p.motivo.slice(0, 12)}…` : p.motivo}</text>
                  </g>
                })}
                <polyline points={analise.pareto.map((p, i) => `${48 + paretoPasso * (i + 0.5)},${y(p.acumulado)}`).join(' ')} fill="none" stroke="#d97706" strokeWidth="2" />
                {analise.pareto.map((p, i) => <circle key={p.motivo} cx={48 + paretoPasso * (i + 0.5)} cy={y(p.acumulado)} r="4" fill="#d97706"><title>{p.motivo}: {percentual(p.acumulado)} acumulado</title></circle>)}
              </svg>
            </div>
            <div className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Justificativa</TableHead><TableHead>NOK</TableHead><TableHead>% dos NOK</TableHead><TableHead>% acumulado</TableHead><TableHead>Impacto (p.p.)</TableHead></TableRow></TableHeader>
                <TableBody>{analise.pareto.map((p, i) => <TableRow key={p.motivo}><TableCell className="whitespace-normal">{i + 1}. {p.motivo}</TableCell><TableCell>{p.quantidade}</TableCell><TableCell>{percentual(p.pct)}</TableCell><TableCell>{percentual(p.acumulado)}</TableCell><TableCell>{numero(p.impacto)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Impacto = NOK do motivo ÷ veículos-dia elegíveis × 100, em pontos percentuais de perda de fidelização. Cada veículo é contado uma vez por dia para o tipo selecionado. NOK sem motivo preenchido entra como “Sem justificativa”.</p>
          </>}
        </div>
      </>}
    </section>
  )
}
